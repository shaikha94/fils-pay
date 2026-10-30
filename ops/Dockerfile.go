FROM golang:1.25-bookworm AS build
WORKDIR /src
COPY apps/settlement/go.mod apps/settlement/go.sum ./
RUN go mod download
COPY apps/settlement/ ./
RUN CGO_ENABLED=0 go build -p 1 -trimpath -o /out/settlement ./cmd/settlement

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=build /out/settlement ./settlement
USER 65532:65532
CMD ["./settlement", "daemon"]
