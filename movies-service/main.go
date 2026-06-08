package main

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/reflection"
	"google.golang.org/grpc/status"

	pb "github.com/cinegrpc/movies-service/generated"
)

// ── REST types (JSON serialization) ──────────────────────────────────────────

type restMovie struct {
	ID        string   `json:"id"`
	Title     string   `json:"title"`
	Genre     string   `json:"genre"`
	Year      int32    `json:"year"`
	Director  string   `json:"director"`
	Synopsis  string   `json:"synopsis"`
	Cast      []string `json:"cast"`
	PosterURL string   `json:"poster_url,omitempty"`
}

type restCreateMovieReq struct {
	Title     string   `json:"title"`
	Genre     string   `json:"genre"`
	Year      int32    `json:"year"`
	Director  string   `json:"director"`
	Synopsis  string   `json:"synopsis"`
	Cast      []string `json:"cast"`
	PosterURL string   `json:"poster_url"`
}

type restBulkImportReq struct {
	Movies []restCreateMovieReq `json:"movies"`
}

type restBulkImportRes struct {
	Imported int32    `json:"imported"`
	Failed   int32    `json:"failed"`
	Errors   []string `json:"errors"`
}

func pbMovieToRest(m *pb.Movie) restMovie {
	cast := m.Cast
	if cast == nil {
		cast = []string{}
	}
	return restMovie{
		ID:        m.Id,
		Title:     m.Title,
		Genre:     m.Genre,
		Year:      m.Year,
		Director:  m.Director,
		Synopsis:  m.Synopsis,
		Cast:      cast,
		PosterURL: m.PosterUrl,
	}
}

func writeJSON(w http.ResponseWriter, statusCode int, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)
	json.NewEncoder(w).Encode(v) //nolint:errcheck
}

func writeError(w http.ResponseWriter, statusCode int, msg string) {
	writeJSON(w, statusCode, map[string]string{"error": msg})
}


type movieServer struct {
	pb.UnimplementedMovieServiceServer
	mu     sync.RWMutex
	movies map[string]*pb.Movie
}

func newMovieServer() *movieServer {
	s := &movieServer{movies: make(map[string]*pb.Movie)}
	s.seedMovies()
	return s
}


func (s *movieServer) seedMovies() {
	seed := []*pb.Movie{
		{
			Id: "1", Title: "O Poderoso Chefão", Genre: "Crime", Year: 1972,
			Director: "Francis Ford Coppola",
			Synopsis: "A saga da família Corleone no mundo do crime organizado americano.",
			Cast:     []string{"Marlon Brando", "Al Pacino", "James Caan"},
		},
		{
			Id: "2", Title: "Interestelar", Genre: "Ficção Científica", Year: 2014,
			Director: "Christopher Nolan",
			Synopsis: "Astronautas viajam por um buraco de minhoca em busca de um novo lar para a humanidade.",
			Cast: []string{"Matthew McConaughey", "Anne Hathaway", "Jessica Chastain"},
		},
		{
			Id: "3", Title: "Parasita", Genre: "Drama", Year: 2019,
			Director: "Bong Joon-ho",
			Synopsis: "Uma família pobre se infiltra progressivamente na vida de uma família rica.",
			Cast: []string{"Song Kang-ho", "Lee Sun-kyun", "Cho Yeo-jeong"},
		},
		{
			Id: "4", Title: "Clube da Luta", Genre: "Drama", Year: 1999,
			Director: "David Fincher",
			Synopsis: "Um insone e um vendedor de sabão formam um clube de luta clandestino.",
			Cast: []string{"Brad Pitt", "Edward Norton", "Helena Bonham Carter"},
		},
		{
			Id: "5", Title: "Matrix", Genre: "Ficção Científica", Year: 1999,
			Director: "Lana Wachowski",
			Synopsis: "Um hacker descobre que a realidade é uma simulação controlada por máquinas.",
			Cast: []string{"Keanu Reeves", "Laurence Fishburne", "Carrie-Anne Moss"},
		},
		{
			Id: "6", Title: "Cidade de Deus", Genre: "Crime", Year: 2002,
			Director: "Fernando Meirelles",
			Synopsis: "Traficantes numa favela carioca vistos pelo ponto de vista de um jovem fotógrafo.",
			Cast: []string{"Alexandre Rodrigues", "Leandro Firmino", "Phellipe Haagensen"},
		},
		{
			Id: "7", Title: "Coringa", Genre: "Drama", Year: 2019,
			Director: "Todd Phillips",
			Synopsis: "A origem do vilão mais famoso dos quadrinhos em uma Gotham decadente.",
			Cast: []string{"Joaquin Phoenix", "Robert De Niro", "Zazie Beetz"},
		},
		{
			Id: "8", Title: "Oppenheimer", Genre: "Drama", Year: 2023,
			Director: "Christopher Nolan",
			Synopsis: "O físico que liderou o projeto que criou a primeira bomba atômica.",
			Cast: []string{"Cillian Murphy", "Emily Blunt", "Matt Damon"},
		},
	}

	for _, m := range seed {
		s.movies[m.Id] = m
	}
}



func (s *movieServer) GetMovie(_ context.Context, req *pb.GetMovieRequest) (*pb.Movie, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	m, ok := s.movies[req.Id]
	if !ok {
		return nil, status.Errorf(codes.NotFound, "filme com id %q não encontrado", req.Id)
	}
	return m, nil
}


func (s *movieServer) CreateMovie(_ context.Context, req *pb.CreateMovieRequest) (*pb.Movie, error) {
	if strings.TrimSpace(req.Title) == "" {
		return nil, status.Error(codes.InvalidArgument, "título é obrigatório")
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	movie := &pb.Movie{
		Id: uuid.NewString(),
		Title: req.Title,
		Genre: req.Genre,
		Year: req.Year,
		Director: req.Director,
		Synopsis: req.Synopsis,
		Cast: req.Cast,
		PosterUrl: req.PosterUrl,
	}
	s.movies[movie.Id] = movie
	return movie, nil
}


func (s *movieServer) ListMovies(req *pb.ListMoviesRequest, stream pb.MovieService_ListMoviesServer) error {
	s.mu.RLock()
	snapshot := make([]*pb.Movie, 0, len(s.movies))
	for _, m := range s.movies {
		snapshot = append(snapshot, m)
	}
	s.mu.RUnlock()

	for _, movie := range snapshot {
		if req.Genre != "" && !strings.EqualFold(movie.Genre, req.Genre) {
			continue
		}
		if err := stream.Send(movie); err != nil {
			return err
		}
		time.Sleep(5 * time.Millisecond)
	}
	return nil
}


func (s *movieServer) BulkImportMovies(stream pb.MovieService_BulkImportMoviesServer) error {
	var imported, failed int32
	var errs []string

	for {
		req, err := stream.Recv()
		if err == io.EOF {
			break
		}
		if err != nil {
			return err
		}

		if strings.TrimSpace(req.Title) == "" {
			failed++
			errs = append(errs, "item ignorado: título vazio")
			continue
		}

		s.mu.Lock()
		movie := &pb.Movie{
			Id: uuid.NewString(),
			Title: req.Title,
			Genre: req.Genre,
			Year: req.Year,
			Director: req.Director,
			Synopsis: req.Synopsis,
			Cast: req.Cast,
			PosterUrl: req.PosterUrl,
		}
		s.movies[movie.Id] = movie
		s.mu.Unlock()

		imported++
	}

	return stream.SendAndClose(&pb.ImportResult{
		Imported: imported,
		Failed: failed,
		Errors: errs,
	})
}


// ── REST handlers ─────────────────────────────────────────────────────────────

func (s *movieServer) handleMovies(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		genre := r.URL.Query().Get("genre")
		s.mu.RLock()
		snapshot := make([]*pb.Movie, 0, len(s.movies))
		for _, m := range s.movies {
			if genre == "" || strings.EqualFold(m.Genre, genre) {
				snapshot = append(snapshot, m)
			}
		}
		s.mu.RUnlock()

		result := make([]restMovie, len(snapshot))
		for i, m := range snapshot {
			result[i] = pbMovieToRest(m)
		}
		writeJSON(w, http.StatusOK, result)

	case http.MethodPost:
		var req restCreateMovieReq
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeError(w, http.StatusBadRequest, "JSON inválido: "+err.Error())
			return
		}
		if strings.TrimSpace(req.Title) == "" {
			writeError(w, http.StatusUnprocessableEntity, "título é obrigatório")
			return
		}

		s.mu.Lock()
		movie := &pb.Movie{
			Id:        uuid.NewString(),
			Title:     req.Title,
			Genre:     req.Genre,
			Year:      req.Year,
			Director:  req.Director,
			Synopsis:  req.Synopsis,
			Cast:      req.Cast,
			PosterUrl: req.PosterURL,
		}
		s.movies[movie.Id] = movie
		s.mu.Unlock()

		writeJSON(w, http.StatusCreated, pbMovieToRest(movie))

	default:
		writeError(w, http.StatusMethodNotAllowed, "método não permitido")
	}
}

func (s *movieServer) handleBulkImport(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeError(w, http.StatusMethodNotAllowed, "método não permitido")
		return
	}

	var req restBulkImportReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "JSON inválido: "+err.Error())
		return
	}

	var imported, failed int32
	errs := []string{}

	s.mu.Lock()
	for _, m := range req.Movies {
		if strings.TrimSpace(m.Title) == "" {
			failed++
			errs = append(errs, "item ignorado: título vazio")
			continue
		}
		movie := &pb.Movie{
			Id:        uuid.NewString(),
			Title:     m.Title,
			Genre:     m.Genre,
			Year:      m.Year,
			Director:  m.Director,
			Synopsis:  m.Synopsis,
			Cast:      m.Cast,
			PosterUrl: m.PosterURL,
		}
		s.movies[movie.Id] = movie
		imported++
	}
	s.mu.Unlock()

	writeJSON(w, http.StatusCreated, restBulkImportRes{Imported: imported, Failed: failed, Errors: errs})
}

func (s *movieServer) handleMovieByID(w http.ResponseWriter, r *http.Request) {
	id := strings.TrimPrefix(r.URL.Path, "/movies/")
	if id == "" || strings.Contains(id, "/") {
		writeError(w, http.StatusNotFound, "não encontrado")
		return
	}

	if r.Method != http.MethodGet {
		writeError(w, http.StatusMethodNotAllowed, "método não permitido")
		return
	}

	s.mu.RLock()
	m, ok := s.movies[id]
	s.mu.RUnlock()

	if !ok {
		writeError(w, http.StatusNotFound, fmt.Sprintf("filme com id %q não encontrado", id))
		return
	}

	writeJSON(w, http.StatusOK, pbMovieToRest(m))
}

func (s *movieServer) startRESTServer() {
	mux := http.NewServeMux()
	mux.HandleFunc("/movies/bulk", s.handleBulkImport)
	mux.HandleFunc("/movies/", s.handleMovieByID)
	mux.HandleFunc("/movies", s.handleMovies)

	log.Println("Movies REST API (Módulo A) escutando em :8081")
	if err := http.ListenAndServe(":8081", mux); err != nil {
		log.Fatalf("falha ao servir REST: %v", err)
	}
}

// ── gRPC + REST bootstrap ─────────────────────────────────────────────────────

func main() {
	srv := newMovieServer()

	lis, err := net.Listen("tcp", ":50051")
	if err != nil {
		log.Fatalf("falha ao abrir porta 50051: %v", err)
	}

	grpcServer := grpc.NewServer()
	pb.RegisterMovieServiceServer(grpcServer, srv)
	reflection.Register(grpcServer)

	go srv.startRESTServer()

	log.Println("Movies Service (Módulo A) escutando em :50051")
	if err := grpcServer.Serve(lis); err != nil {
		log.Fatalf("falha ao servir: %v", err)
	}
}
