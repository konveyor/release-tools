package action

// https://docs.github.com/en/actions/using-workflows/workflow-commands-for-github-actions
// TODO(djzager): consider allowing file location + title
import (
	"fmt"
	"os"
)

func sendCommand(command, message string) {
	fmt.Fprintf(os.Stdout, "::"+command+"::"+message+"\n")
}

func DebugCommand(message string) {
	sendCommand("debug", message)
}

func NoticeCommand(message string) {
	sendCommand("notice", message)
}

func WarningCommand(message string) {
	sendCommand("warning", message)
}

func ErrorCommand(message string) {
	sendCommand("error", message)
}

// SetOutput writes a key=value pair to the GITHUB_OUTPUT file so that
// downstream steps and jobs can consume it via steps.<id>.outputs.<key>.
func SetOutput(key, value string) error {
	outputFile := os.Getenv("GITHUB_OUTPUT")
	if outputFile == "" {
		return nil
	}
	f, err := os.OpenFile(outputFile, os.O_APPEND|os.O_WRONLY, 0644)
	if err != nil {
		return fmt.Errorf("unable to open GITHUB_OUTPUT: %w", err)
	}
	defer f.Close()
	_, err = fmt.Fprintf(f, "%s=%s\n", key, value)
	return err
}
