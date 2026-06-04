import pytest

def test_health(client):
    resp = client.get("/health")
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "ok"
    assert "movies_addr" in body
    assert "reviews_addr" in body


def test_list_movies(client):
    resp = client.get("/movies")
    assert resp.status_code == 200
    movies = resp.json()
    assert len(movies) == 3
    first = movies[0]
    assert "id" in first
    assert "title" in first
    assert "genre" in first
    assert "year" in first
    assert "director" in first


def test_list_movies_with_genre_filter(client):
    resp = client.get("/movies?genre=Drama")
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)



def test_get_movie_detail(client):
    resp = client.get("/movies/abc")
    assert resp.status_code == 200
    body = resp.json()

    # Filme
    assert body["movie"]["id"] == "abc"
    assert body["movie"]["title"] == "Filme Mock"

    assert body["rating"]["movie_id"] == "abc"
    assert body["rating"]["average"] == pytest.approx(8.5, abs=0.01)
    assert body["rating"]["total_reviews"] == 3

    assert len(body["reviews"]) == 2
    assert body["reviews"][0]["author"] == "Alice"
    assert body["reviews"][1]["author"] == "Bob"


def test_create_movie(client):
    payload = {
        "title": "Novo Filme",
        "genre": "Ficção Científica",
        "year": 2025,
        "director": "Diretor Teste",
        "synopsis": "Uma história incrível.",
        "cast": ["Atriz A", "Ator B"],
        "poster_url": "",
    }
    resp = client.post("/movies", json=payload)
    assert resp.status_code == 201
    body = resp.json()
    assert body["id"] == "new-123"
    assert body["title"] == "Novo Filme"
    assert body["director"] == "Diretor Teste"


def test_bulk_import(client):
    payload = {
        "movies": [
            {"title": "Filme A", "genre": "Ação",  "year": 2020, "director": "Dir A"},
            {"title": "Filme B", "genre": "Drama",  "year": 2021, "director": "Dir B"},
        ]
    }
    resp = client.post("/movies/bulk-import", json=payload)
    assert resp.status_code == 201
    body = resp.json()
    assert body["imported"] == 2
    assert body["failed"] == 0
    assert body["errors"] == []


def test_add_review(client):
    payload = {"author": "Carlos", "rating": 9.5, "comment": "Sensacional!"}
    resp = client.post("/movies/abc/reviews", json=payload)
    assert resp.status_code == 201
    body = resp.json()
    assert body["id"] == "rev-1"
    assert body["movie_id"] == "abc"
    assert body["author"] == "Carlos"
    assert body["rating"] == pytest.approx(9.5, abs=0.01)


def test_add_review_rating_out_of_range(client):
    payload = {"author": "X", "rating": 11.0, "comment": ""}
    resp = client.post("/movies/abc/reviews", json=payload)
    # FastAPI tem que rejeitar antes de chamar o gRPC (validação Pydantic)
    assert resp.status_code == 422



def test_get_rating(client):
    resp = client.get("/movies/abc/rating")
    assert resp.status_code == 200
    body = resp.json()
    assert body["movie_id"] == "abc"
    assert body["average"] == pytest.approx(8.5, abs=0.01)
    assert body["total_reviews"] == 3
