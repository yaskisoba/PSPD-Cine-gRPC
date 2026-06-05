'use strict';

const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');

// Resolve proto path: works both locally (../proto/) and inside Docker (./proto/)
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

// ── In-memory store: Map<movie_id, Review[]> ──────────────────────────────────
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

// ── Helpers ───────────────────────────────────────────────────────────────────
function calcAverage(movieId) {
  const list = reviewsDB.get(movieId) || [];
  if (list.length === 0) return { average: 0.0, total_reviews: 0 };
  const sum = list.reduce((acc, r) => acc + r.rating, 0);
  return { average: parseFloat((sum / list.length).toFixed(2)), total_reviews: list.length };
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

// ── Unary: AddReview ──────────────────────────────────────────────────────────
function addReview(call, callback) {
  const { movie_id, author, rating, comment } = call.request;
  console.log(`[ReviewsService] AddReview called | movie_id=${movie_id}`);

  if (!movie_id || !author || !comment) {
    return callback({
      code: grpc.status.INVALID_ARGUMENT,
      message: 'Campos obrigatórios ausentes: movie_id, author, comment',
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
    comment,
    created_at: new Date().toISOString(),
  };

  if (!reviewsDB.has(movie_id)) reviewsDB.set(movie_id, []);
  reviewsDB.get(movie_id).push(review);

  callback(null, review);
}

// ── Unary: GetMovieRating ─────────────────────────────────────────────────────
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

// ── Server Streaming: GetMovieReviews ─────────────────────────────────────────
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

// ── Bidirectional Streaming: LiveReviewSession ────────────────────────────────
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

// ── Server bootstrap ──────────────────────────────────────────────────────────
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

// ── Graceful shutdown ─────────────────────────────────────────────────────────
function shutdown(signal) {
  console.log(`[ReviewsService] Received ${signal}, shutting down gracefully...`);
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
