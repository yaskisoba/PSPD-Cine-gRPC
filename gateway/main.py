import os
import sys
import pathlib

_GENERATED_DIR = pathlib.Path(__file__).parent / "generated"
if str(_GENERATED_DIR) not in sys.path:
    sys.path.insert(0, str(_GENERATED_DIR))

import grpc
from contextlib import asynccontextmanager
from typing import List, Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from generated import movies_pb2, movies_pb2_grpc
from generated import reviews_pb2, reviews_pb2_grpc


MOVIES_ADDR = os.getenv("MOVIES_SERVICE_ADDR",  "localhost:50051")
REVIEWS_ADDR = os.getenv("REVIEWS_SERVICE_ADDR", "localhost:50052")


movie_stub:  movies_pb2_grpc.MovieServiceStub  | None = None
review_stub: reviews_pb2_grpc.ReviewServiceStub | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global movie_stub, review_stub

    movies_channel = grpc.insecure_channel(MOVIES_ADDR)
    reviews_channel = grpc.insecure_channel(REVIEWS_ADDR)

    movie_stub = movies_pb2_grpc.MovieServiceStub(movies_channel)
    review_stub = reviews_pb2_grpc.ReviewServiceStub(reviews_channel)

    yield

    movies_channel.close()
    reviews_channel.close()


app = FastAPI(
    title="CineGRPC Gateway",
    description="API Gateway que traduz REST -> gRPC para os serviços Movies (A) e Reviews (B).",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class MovieOut(BaseModel):
    id: str
    title: str
    genre: str
    year: int
    director: str
    synopsis: str = ""
    cast: List[str] = []
    poster_url: str = ""


class CreateMovieIn(BaseModel):
    title: str
    genre: str
    year: int
    director: str
    synopsis: str = ""
    cast: List[str] = []
    poster_url: str = ""


class ReviewOut(BaseModel):
    id: str
    movie_id: str
    author: str
    rating: float
    comment: str = ""
    created_at: str = ""


class AddReviewIn(BaseModel):
    author: str
    rating: float = Field(ge=0, le=10)
    comment: str = ""


class RatingOut(BaseModel):
    movie_id: str
    average: float
    total_reviews: int


class MovieDetailOut(BaseModel):
    movie:   MovieOut
    rating:  RatingOut
    reviews: List[ReviewOut]


class BulkImportIn(BaseModel):
    movies: List[CreateMovieIn]


class BulkImportOut(BaseModel):
    imported: int
    failed: int
    errors: List[str] = []



def _movie_to_dict(m) -> MovieOut:
    return MovieOut(
        id=m.id,
        title=m.title,
        genre=m.genre,
        year=m.year,
        director=m.director,
        synopsis=m.synopsis,
        cast=list(m.cast),
        poster_url=m.poster_url,
    )


def _review_to_dict(r) -> ReviewOut:
    return ReviewOut(
        id=r.id,
        movie_id=r.movie_id,
        author=r.author,
        rating=r.rating,
        comment=r.comment,
        created_at=r.created_at,
    )


def _rating_to_dict(r) -> RatingOut:
    return RatingOut(
        movie_id=r.movie_id,
        average=r.average,
        total_reviews=r.total_reviews,
    )


def _grpc_error(e: grpc.RpcError) -> HTTPException:
    code = e.code()
    if code == grpc.StatusCode.NOT_FOUND:
        return HTTPException(status_code=404, detail=e.details())
    if code == grpc.StatusCode.INVALID_ARGUMENT:
        return HTTPException(status_code=422, detail=e.details())
    return HTTPException(status_code=502, detail=f"gRPC error: {e.details()}")


@app.get("/health")
def health():
    return {"status": "ok", "movies_addr": MOVIES_ADDR, "reviews_addr": REVIEWS_ADDR}



@app.get("/movies", response_model=List[MovieOut])
def list_movies(genre: Optional[str] = None):
    try:
        request = movies_pb2.ListMoviesRequest(genre=genre or "")
        return [_movie_to_dict(m) for m in movie_stub.ListMovies(request)]
    except grpc.RpcError as e:
        raise _grpc_error(e)


@app.get("/movies/{movie_id}", response_model=MovieDetailOut)
def get_movie(movie_id: str):
    try:
        movie = movie_stub.GetMovie(movies_pb2.GetMovieRequest(id=movie_id))
    except grpc.RpcError as e:
        raise _grpc_error(e)

    try:
        rating  = review_stub.GetMovieRating(reviews_pb2.GetRatingRequest(movie_id=movie_id))
        reviews = [
            _review_to_dict(r)
            for r in review_stub.GetMovieReviews(reviews_pb2.GetReviewsRequest(movie_id=movie_id))
        ]
    except grpc.RpcError as e:
        raise _grpc_error(e)

    return MovieDetailOut(
        movie=_movie_to_dict(movie),
        rating=_rating_to_dict(rating),
        reviews=reviews,
    )


@app.post("/movies", response_model=MovieOut, status_code=201)
def create_movie(body: CreateMovieIn):
    try:
        req = movies_pb2.CreateMovieRequest(
            title=body.title,
            genre=body.genre,
            year=body.year,
            director=body.director,
            synopsis=body.synopsis,
            cast=body.cast,
            poster_url=body.poster_url,
        )
        return _movie_to_dict(movie_stub.CreateMovie(req))
    except grpc.RpcError as e:
        raise _grpc_error(e)


@app.post("/movies/bulk-import", response_model=BulkImportOut, status_code=201)
def bulk_import(body: BulkImportIn):
    def _generate():
        for m in body.movies:
            yield movies_pb2.CreateMovieRequest(
                title=m.title,
                genre=m.genre,
                year=m.year,
                director=m.director,
                synopsis=m.synopsis,
                cast=m.cast,
                poster_url=m.poster_url,
            )

    try:
        result = movie_stub.BulkImportMovies(_generate())
        return BulkImportOut(
            imported=result.imported,
            failed=result.failed,
            errors=list(result.errors),
        )
    except grpc.RpcError as e:
        raise _grpc_error(e)



@app.post("/movies/{movie_id}/reviews", response_model=ReviewOut, status_code=201)
def add_review(movie_id: str, body: AddReviewIn):
    try:
        req = reviews_pb2.AddReviewRequest(
            movie_id=movie_id,
            author=body.author,
            rating=body.rating,
            comment=body.comment,
        )
        return _review_to_dict(review_stub.AddReview(req))
    except grpc.RpcError as e:
        raise _grpc_error(e)


@app.get("/movies/{movie_id}/rating", response_model=RatingOut)
def get_rating(movie_id: str):
    try:
        req = reviews_pb2.GetRatingRequest(movie_id=movie_id)
        return _rating_to_dict(review_stub.GetMovieRating(req))
    except grpc.RpcError as e:
        raise _grpc_error(e)
