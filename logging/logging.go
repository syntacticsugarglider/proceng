package logging

import (
	"fmt"
	"log"

	"github.com/go-errors/errors"
	"github.com/ttacon/chalk"
)

//Error logs an error
func Error(err error) {
	fmt.Println(chalk.Red, err.(*errors.Error).ErrorStack())
}

//Log logs
func Log(message string) {
	log.Println(chalk.Green, chalk.Underline.TextStyle(message))
}

//Green just sets the output color
func Green() {
	fmt.Print(chalk.Green)
}

//Red prints an error
func Red(message error) {
	fmt.Print(chalk.Red)
	log.Println(message)
	fmt.Print(chalk.Green)
}

//L logs without styling
func L(message string) {
	log.Println(message)
}
