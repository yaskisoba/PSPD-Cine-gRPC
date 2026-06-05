package main

import (
	"context"
	"io"
	"log"
	"net"
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


func main() {
	lis, err := net.Listen("tcp", ":50051")
	if err != nil {
		log.Fatalf("falha ao abrir porta 50051: %v", err)
	}

	grpcServer := grpc.NewServer()
	pb.RegisterMovieServiceServer(grpcServer, newMovieServer())
	reflection.Register(grpcServer)

	log.Println("Movies Service (Módulo A) escutando em :50051")
	if err := grpcServer.Serve(lis); err != nil {
		log.Fatalf("falha ao servir: %v", err)
	}
}
