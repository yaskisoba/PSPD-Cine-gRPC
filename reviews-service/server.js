'use strict';

const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');
const http = require('http');

const localProto = path.join(__dirname, '..', 'proto', 'reviews.proto');
const dockerProto = path.join(__dirname, 'proto', 'reviews.proto');
const PROTO_PATH = fs.existsSync(localProto) ? localProto : dockerProto;

const packageDef = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const reviewsProto = grpc.loadPackageDefinition(packageDef).reviews;

const reviewsDB = new Map();

const seedReviews = [
  { movie_id: '1', author: 'Ana Lima',       rating: 9.5,  comment: 'Uma obra-prima da ficção científica!' },
  { movie_id: '1', author: 'Carlos Souza',   rating: 8.0,  comment: 'Roteiro complexo, mas vale a pena.' },
  { movie_id: '2', author: 'Maria Oliveira', rating: 10.0, comment: 'O melhor filme de super-herói já feito.' },
  { movie_id: '2', author: 'João Pedro',     rating: 9.5,  comment: 'Heath Ledger é incrível como Coringa.' },
  { movie_id: '3', author: 'Fernanda Costa', rating: 9.0,  comment: 'Visualmente deslumbrante.' },
  { movie_id: '4', author: 'Lucas Martins',  rating: 9.5,  comment: 'Diálogos perfeitos, Tarantino no auge.' },
  { movie_id: '5', author: 'Juliana Alves',  rating: 9.0,  comment: 'Revolucionou o cinema de ação.' },
  { movie_id: '6', author: 'Rafael Nunes',   rating: 9.8,  comment: 'Merecia o Oscar de Melhor Filme.' },
  { movie_id: '7', author: 'Camila Torres',  rating: 10.0, comment: 'Miyazaki é um gênio sem igual.' },
  { movie_id: '8', author: 'Bruno Santos',   rating: 9.2,  comment: 'Final surpreendente, assisti três vezes.' },
];

seedReviews.forEach(r => {
  const review = { ...r, id: uuidv4(), created_at: new Date().toISOString() };
  if (!reviewsDB.has(r.movie_id)) reviewsDB.set(r.movie_id, []);
  reviewsDB.get(r.movie_id).push(review);
});

function calcAverage(movieId) {
  const list = reviewsDB.get(movieId) || [];
  if (list.length === 0) return { average: 0.0, total_reviews: 0 };
  const sum = list.reduce((acc, r) => acc + r.rating, 0);
  return { average: parseFloat((sum / list.length).toFixed(2)), total_reviews: list.length };
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function addReview(call, callback) {
  const { movie_id, author, rating, comment } = call.request;
  console.log(`[ReviewsService] AddReview called | movie_id=${movie_id}`);

  if (!movie_id || !author) {
    return callback({
      code: grpc.status.INVALID_ARGUMENT,
      message: 'Campos obrigatórios ausentes: movie_id, author',
    });
  }
  if (rating == null || rating < 0.0 || rating > 10.0) {
    return callback({
      code: grpc.status.INVALID_ARGUMENT,
      message: 'rating deve ser um número entre 0.0 e 10.0',
    });
  }

  const review = {
    id: uuidv4(),
    movie_id,
    author,
    rating,
    comment: comment || '',
    created_at: new Date().toISOString(),
  };

  if (!reviewsDB.has(movie_id)) reviewsDB.set(movie_id, []);
  reviewsDB.get(movie_id).push(review);

  callback(null, review);
}

function getMovieRating(call, callback) {
  const { movie_id } = call.request;
  console.log(`[ReviewsService] GetMovieRating called | movie_id=${movie_id}`);

  if (!movie_id) {
    return callback({
      code: grpc.status.INVALID_ARGUMENT,
      message: 'movie_id é obrigatório',
    });
  }

  const { average, total_reviews } = calcAverage(movie_id);
  callback(null, { movie_id, average, total_reviews });
}

function getMovieReviews(call) {
  const { movie_id } = call.request;
  const list = reviewsDB.get(movie_id) || [];
  console.log(`[ReviewsService] GetMovieReviews called | movie_id=${movie_id} | count=${list.length}`);

  let cancelled = false;
  call.on('cancelled', () => { cancelled = true; });

  async function streamAll() {
    for (let i = 0; i < list.length; i++) {
      if (cancelled) return;
      call.write(list[i]);
      if (i < list.length - 1) await sleep(50);
    }
    if (!cancelled) call.end();
  }

  streamAll().catch(err => {
    console.error(`[ReviewsService] GetMovieReviews error | movie_id=${movie_id}`, err);
    if (!cancelled) call.end();
  });
}

function liveReviewSession(call) {
  console.log('[ReviewsService] LiveReviewSession called | session started');

  call.on('data', (update) => {
    const { movie_id, author, rating, comment } = update;

    if (!movie_id || !author || rating == null || rating < 0.0 || rating > 10.0) {
      console.error(`[ReviewsService] LiveReviewSession invalid update | movie_id=${movie_id}`);
      return;
    }

    const review = {
      id: uuidv4(),
      movie_id,
      author,
      rating,
      comment: comment || '',
      created_at: new Date().toISOString(),
    };

    if (!reviewsDB.has(movie_id)) reviewsDB.set(movie_id, []);
    reviewsDB.get(movie_id).push(review);

    const { average: new_average, total_reviews } = calcAverage(movie_id);
    console.log(`[ReviewsService] LiveReviewSession update | movie_id=${movie_id} | new_average=${new_average}`);
    call.write({ movie_id, new_average, total_reviews });
  });

  call.on('end', () => {
    console.log('[ReviewsService] LiveReviewSession called | session ended by client');
    call.end();
  });

  call.on('error', (err) => {
    console.error('[ReviewsService] LiveReviewSession error:', err.message);
    try { call.end(); } catch (_) { /* stream already closed */ }
  });
}

const server = new grpc.Server();

server.addService(reviewsProto.ReviewService.service, {
  AddReview: addReview,
  GetMovieRating: getMovieRating,
  GetMovieReviews: getMovieReviews,
  LiveReviewSession: liveReviewSession,
});

const PORT = process.env.PORT || '50052';

server.bindAsync(
  `0.0.0.0:${PORT}`,
  grpc.ServerCredentials.createInsecure(),
  (err, port) => {
    if (err) {
      console.error('[ReviewsService] Failed to start server:', err);
      process.exit(1);
    }
    console.log(`Reviews Service running on port ${port}`);
  }
);


function parseBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => { data += chunk; });
    req.on('end', () => {
      try { resolve(data ? JSON.parse(data) : {}); }
      catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

function sendJSON(res, statusCode, obj) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(obj));
}

const RATING_RE  = /^\/movies\/([^/]+)\/rating$/;
const REVIEWS_RE = /^\/movies\/([^/]+)\/reviews$/;

const restServer = http.createServer(async (req, res) => {
  const { method } = req;
  const pathname = req.url.split('?')[0];

  try {
    if (method === 'POST' && pathname === '/reviews') {
      const body = await parseBody(req);
      const { movie_id, author, rating, comment } = body;

      if (!movie_id || !author) {
        return sendJSON(res, 422, { error: 'Campos obrigatórios ausentes: movie_id, author' });
      }
      if (rating == null || rating < 0.0 || rating > 10.0) {
        return sendJSON(res, 422, { error: 'rating deve ser entre 0.0 e 10.0' });
      }

      const review = {
        id: uuidv4(),
        movie_id,
        author,
        rating,
        comment: comment || '',
        created_at: new Date().toISOString(),
      };

      if (!reviewsDB.has(movie_id)) reviewsDB.set(movie_id, []);
      reviewsDB.get(movie_id).push(review);

      console.log(`[REST] AddReview | movie_id=${movie_id}`);
      return sendJSON(res, 201, review);
    }

    let m;

    if (method === 'GET' && (m = RATING_RE.exec(pathname))) {
      const movie_id = m[1];
      const { average, total_reviews } = calcAverage(movie_id);
      console.log(`[REST] GetMovieRating | movie_id=${movie_id}`);
      return sendJSON(res, 200, { movie_id, average, total_reviews });
    }

    if (method === 'GET' && (m = REVIEWS_RE.exec(pathname))) {
      const movie_id = m[1];
      const list = reviewsDB.get(movie_id) || [];
      console.log(`[REST] GetMovieReviews | movie_id=${movie_id} | count=${list.length}`);
      return sendJSON(res, 200, list);
    }

    sendJSON(res, 404, { error: 'Not Found' });
  } catch (err) {
    console.error('[REST] Error:', err);
    sendJSON(res, 500, { error: 'Internal Server Error' });
  }
});

const REST_PORT = process.env.REST_PORT || '8082';

restServer.listen(REST_PORT, () => {
  console.log(`Reviews REST API (Módulo B) escutando na porta ${REST_PORT}`);
});

restServer.on('error', err => {
  console.error('[REST] Server error:', err);
});

function shutdown(signal) {
  console.log(`[ReviewsService] Received ${signal}, shutting down gracefully...`);
  restServer.close();
  server.tryShutdown(err => {
    if (err) {
      console.error('[ReviewsService] Shutdown error:', err);
      process.exit(1);
    }
    console.log('[ReviewsService] Server stopped.');
    process.exit(0);
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));
