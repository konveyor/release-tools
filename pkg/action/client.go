package action

import (
	"net/http"
	"net/url"
	"os"
	"strings"

	"github.com/google/go-github/v55/github"
	"golang.org/x/oauth2"
)

func GetClient() *github.Client {
	baseURL, err := url.Parse("https://api.github.com")
	if err != nil {
		ErrorCommand("Bad endpoint")
		os.Exit(1)
	}
	if !strings.HasSuffix(baseURL.Path, "/") {
		baseURL.Path += "/"
	}
	token := os.Getenv("GITHUB_TOKEN")
	if token == "" {
		ErrorCommand("GITHUB_TOKEN environment variable not specified")
		os.Exit(1)
	}

	httpClient := &http.Client{
		Transport: &oauth2.Transport{
			Base:   http.DefaultTransport,
			Source: oauth2.ReuseTokenSource(nil, oauth2.StaticTokenSource(&oauth2.Token{AccessToken: token})),
		},
	}
	client := github.NewClient(httpClient)
	client.BaseURL = baseURL

	return client
}
