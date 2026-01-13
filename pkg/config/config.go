package config

import (
	"os"

	"github.com/konveyor/release-tools/pkg/action"
	"gopkg.in/yaml.v2"
)

func LoadConfig(path string) (*Configuration, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		action.ErrorCommand("Failed reading config")
		return nil, err
	}

	var c Configuration
	if err = yaml.Unmarshal(data, &c); err != nil {
		action.ErrorCommand("Failed to unmarshal config")
		return nil, err
	}
	return &c, nil
}

// LoadMaintainerConfig loads the maintainer configuration from the specified YAML file
func LoadMaintainerConfig(path string) (*MaintainerConfig, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		action.ErrorCommand("Failed reading maintainer config")
		return nil, err
	}

	var mc MaintainerConfig
	if err = yaml.Unmarshal(data, &mc); err != nil {
		action.ErrorCommand("Failed to unmarshal maintainer config")
		return nil, err
	}
	return &mc, nil
}
