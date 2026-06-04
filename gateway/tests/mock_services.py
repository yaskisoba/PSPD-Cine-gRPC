import sys
import pathlib

_GENERATED_DIR = pathlib.Path(__file__).parent.parent / "generated"
if str(_GENERATED_DIR) not in sys.path:
    sys.path.insert(0, str(_GENERATED_DIR))

import grpc
from concurrent import futures

from generated import movies_pb2, movies_pb2_grpc
from generated import reviews_pb2, reviews_pb2_grpc



STATIC_MOVIES = [
    movies_pb2.Movie(id="1", title="O Poderoso Chefão", genre="Crime",  year=1972, director="Francis Ford Coppola"),
    movies_pb2.Movie(id="2", title="Interestelar",       genre="Drama",  year=2014, director="Christopher Nolan"),
    movies_pb2.Movie(id="3", title="Parasita",           genre="Drama",  year=2019, director="Bong Joon-ho"),
]

STATIC_REVIEWS = [
    reviews_pb2.Review(id="r1", movie_id="abc", author="Alice", rating=9.0, comment="Ótimo!",    created_at="2024-01-01"),
    reviews_pb2.Review(id="r2", movie_id="abc", author="Bob",   rating=8.0, comment="Muito bom", created_at="2024-01-02"),
]


class MockMovieServicer(movies_pb2_grpc.MovieServiceServicer):

    def GetMovie(self, request, context):
        return movies_pb2.Movie(
            id=request.id,
            title="Filme Mock",
            genre="Ação",
            year=2024,
            director="Diretor Mock",
            synopsis="Sinopse mock.",
            cast=["Ator 1", "Ator 2"],
            poster_url="",
        )

    def CreateMovie(self, request, context):
        return movies_pb2.Movie(
            id="new-123",
            title=request.title,
            genre=request.genre,
            year=request.year,
            director=request.director,
            synopsis=request.synopsis,
            cast=list(request.cast),
            poster_url=request.poster_url,
        )

    def ListMovies(self, request, context):
        for movie in STATIC_MOVIES:
            yield movie

    def BulkImportMovies(self, request_iterator, context):
        count = sum(1 for _ in request_iterator)
        return movies_pb2.ImportResult(imported=count, failed=0, errors=[])


class MockReviewServicer(reviews_pb2_grpc.ReviewServiceServicer):

    def AddReview(self, request, context):
        return reviews_pb2.Review(
            id="rev-1",
            movie_id=request.movie_id,
            author=request.author,
            rating=request.rating,
            comment=request.comment,
            created_at="2024-06-04",
        )

    def GetMovieRating(self, request, context):
        return reviews_pb2.Rating(
            movie_id=request.movie_id,
            average=8.5,
            total_reviews=3,
        )

    def GetMovieReviews(self, request, context):
        for review in STATIC_REVIEWS:
            yield review

    def LiveReviewSession(self, request_iterator, context):
        for update in request_iterator:
            yield reviews_pb2.RatingUpdate(
                movie_id=update.movie_id,
                new_average=8.5,
                total_reviews=1,
            )



def start_mock_servers(movies_port: int = 59051, reviews_port: int = 59052):
    movies_server = grpc.server(futures.ThreadPoolExecutor(max_workers=2))
    movies_pb2_grpc.add_MovieServiceServicer_to_server(MockMovieServicer(), movies_server)
    movies_server.add_insecure_port(f"[::]:{movies_port}")
    movies_server.start()

    reviews_server = grpc.server(futures.ThreadPoolExecutor(max_workers=2))
    reviews_pb2_grpc.add_ReviewServiceServicer_to_server(MockReviewServicer(), reviews_server)
    reviews_server.add_insecure_port(f"[::]:{reviews_port}")
    reviews_server.start()

    return movies_server, reviews_server
