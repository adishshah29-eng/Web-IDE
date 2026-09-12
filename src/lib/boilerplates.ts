export interface Boilerplate {
  id: string;
  category: string;
  label: string;
  filename: string;
  content: string;
}

// Starter content for "New From Template" in the file tree. Each entry's
// `filename` is just the default suggested name — the create dialog lets the
// user change it before the file is written.
export const BOILERPLATES: Boilerplate[] = [
  // --- Web ---
  {
    id: "html5",
    category: "Web",
    label: "HTML5 Starter",
    filename: "index.html",
    content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>New Page</title>
  <link rel="stylesheet" href="style.css" />
</head>
<body>
  <h1>Hello, world!</h1>
  <script src="script.js"></script>
</body>
</html>
`,
  },
  {
    id: "css-reset",
    category: "Web",
    label: "CSS Starter",
    filename: "style.css",
    content: `* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: system-ui, sans-serif;
  line-height: 1.5;
}
`,
  },
  {
    id: "js-module",
    category: "Web",
    label: "JavaScript Starter",
    filename: "script.js",
    content: `console.log("Hello, world!");
`,
  },

  // --- Languages (Judge0-runnable "hello world") ---
  {
    id: "python",
    category: "Languages",
    label: "Python Script",
    filename: "main.py",
    content: `def main():
    print("Hello, world!")


if __name__ == "__main__":
    main()
`,
  },
  {
    id: "c",
    category: "Languages",
    label: "C Program",
    filename: "main.c",
    content: `#include <stdio.h>

int main(void) {
    printf("Hello, world!\\n");
    return 0;
}
`,
  },
  {
    id: "cpp",
    category: "Languages",
    label: "C++ Program",
    filename: "main.cpp",
    content: `#include <iostream>

int main() {
    std::cout << "Hello, world!" << std::endl;
    return 0;
}
`,
  },
  {
    id: "java",
    category: "Languages",
    label: "Java Class",
    filename: "Main.java",
    content: `public class Main {
    public static void main(String[] args) {
        System.out.println("Hello, world!");
    }
}
`,
  },
  {
    id: "go",
    category: "Languages",
    label: "Go Program",
    filename: "main.go",
    content: `package main

import "fmt"

func main() {
	fmt.Println("Hello, world!")
}
`,
  },
  {
    id: "rust",
    category: "Languages",
    label: "Rust Program",
    filename: "main.rs",
    content: `fn main() {
    println!("Hello, world!");
}
`,
  },
  {
    id: "typescript",
    category: "Languages",
    label: "TypeScript Script",
    filename: "main.ts",
    content: `function main(): void {
  console.log("Hello, world!");
}

main();
`,
  },
  {
    id: "ruby",
    category: "Languages",
    label: "Ruby Script",
    filename: "main.rb",
    content: `def main
  puts "Hello, world!"
end

main
`,
  },
  {
    id: "php",
    category: "Languages",
    label: "PHP Script",
    filename: "main.php",
    content: `<?php

echo "Hello, world!\\n";
`,
  },
  {
    id: "csharp",
    category: "Languages",
    label: "C# Program",
    filename: "Main.cs",
    content: `using System;

class Program {
    static void Main() {
        Console.WriteLine("Hello, world!");
    }
}
`,
  },
  {
    id: "bash",
    category: "Languages",
    label: "Bash Script",
    filename: "script.sh",
    content: `#!/usr/bin/env bash

echo "Hello, world!"
`,
  },

  // --- Docs ---
  {
    id: "readme",
    category: "Docs",
    label: "README",
    filename: "README.md",
    content: `# Project Name

A short description of what this project does.

## Getting Started

1. ...
2. ...
`,
  },
];
