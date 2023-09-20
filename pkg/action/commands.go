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
