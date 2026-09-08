/**
 * Example tools for DeepSeek Harness.
 * Demonstrates how to create and register tools using the tool registry.
 *
 * @module @deepseek-ai/dsh-example-tools
 */

import { Context } from '@deepseek-ai/cordis'
import { ToolRegistryService, ToolDefinition, ToolExecutionContext } from '@deepseek-ai/dsh-tool-registry'

/** Read file tool */
export const readFileTool: ToolDefinition = {
  name: 'read_file',
  description: 'Read the contents of a file',
  category: 'file',
  permissions: ['read'],
  schema: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'Path to the file to read',
      },
    },
    required: ['path'],
  },
  execute: async (args, context) => {
    const { path } = args as { path: string }

    // In a real implementation, this would read the file
    // For now, return a mock result
    return {
      content: `Contents of ${path}`,
      path,
      size: 1024,
      lastModified: new Date().toISOString(),
    }
  },
  readOnly: true,
  streaming: false,
  timeoutMs: 10000,
}

/** Write file tool */
export const writeFileTool: ToolDefinition = {
  name: 'write_file',
  description: 'Write content to a file',
  category: 'file',
  permissions: ['write'],
  schema: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'Path to the file to write',
      },
      content: {
        type: 'string',
        description: 'Content to write to the file',
      },
    },
    required: ['path', 'content'],
  },
  execute: async (args, context) => {
    const { path, content } = args as { path: string; content: string }

    // In a real implementation, this would write the file
    // For now, return a mock result
    return {
      success: true,
      path,
      bytesWritten: content.length,
      timestamp: new Date().toISOString(),
    }
  },
  readOnly: false,
  streaming: false,
  timeoutMs: 10000,
}

/** Execute bash command tool */
export const bashTool: ToolDefinition = {
  name: 'bash',
  description: 'Execute a bash command',
  category: 'shell',
  permissions: ['execute'],
  schema: {
    type: 'object',
    properties: {
      command: {
        type: 'string',
        description: 'Bash command to execute',
      },
      timeout: {
        type: 'number',
        description: 'Timeout in milliseconds',
        default: 30000,
      },
    },
    required: ['command'],
  },
  execute: async (args, context) => {
    const { command, timeout = 30000 } = args as { command: string; timeout?: number }

    // In a real implementation, this would execute the command
    // For now, return a mock result
    return {
      stdout: `Output of: ${command}`,
      stderr: '',
      exitCode: 0,
      duration: 100,
      command,
    }
  },
  readOnly: false,
  streaming: false,
  timeoutMs: 60000,
}

/** Search files tool */
export const globTool: ToolDefinition = {
  name: 'glob',
  description: 'Search for files matching a pattern',
  category: 'search',
  permissions: ['read'],
  schema: {
    type: 'object',
    properties: {
      pattern: {
        type: 'string',
        description: 'Glob pattern to match',
      },
      path: {
        type: 'string',
        description: 'Directory to search in',
        default: '.',
      },
    },
    required: ['pattern'],
  },
  execute: async (args, context) => {
    const { pattern, path = '.' } = args as { pattern: string; path?: string }

    // In a real implementation, this would search for files
    // For now, return a mock result
    return {
      files: [
        `${path}/file1.ts`,
        `${path}/file2.ts`,
        `${path}/file3.ts`,
      ],
      pattern,
      path,
      count: 3,
    }
  },
  readOnly: true,
  streaming: false,
  timeoutMs: 10000,
}

/** Search file contents tool */
export const grepTool: ToolDefinition = {
  name: 'grep',
  description: 'Search for content in files',
  category: 'search',
  permissions: ['read'],
  schema: {
    type: 'object',
    properties: {
      pattern: {
        type: 'string',
        description: 'Search pattern (regex)',
      },
      path: {
        type: 'string',
        description: 'File or directory to search in',
        default: '.',
      },
      include: {
        type: 'string',
        description: 'File pattern to include',
      },
    },
    required: ['pattern'],
  },
  execute: async (args, context) => {
    const { pattern, path = '.', include } = args as {
      pattern: string
      path?: string
      include?: string
    }

    // In a real implementation, this would search file contents
    // For now, return a mock result
    return {
      matches: [
        {
          file: `${path}/file1.ts`,
          line: 10,
          content: `Match for ${pattern}`,
        },
        {
          file: `${path}/file2.ts`,
          line: 20,
          content: `Another match for ${pattern}`,
        },
      ],
      pattern,
      path,
      include,
      count: 2,
    }
  },
  readOnly: true,
  streaming: false,
  timeoutMs: 10000,
}

/** List directory tool */
export const lsTool: ToolDefinition = {
  name: 'ls',
  description: 'List directory contents',
  category: 'file',
  permissions: ['read'],
  schema: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'Directory path to list',
        default: '.',
      },
      recursive: {
        type: 'boolean',
        description: 'List recursively',
        default: false,
      },
    },
  },
  execute: async (args, context) => {
    const { path = '.', recursive = false } = args as { path?: string; recursive?: boolean }

    // In a real implementation, this would list directory contents
    // For now, return a mock result
    return {
      entries: [
        { name: 'file1.ts', type: 'file', size: 1024 },
        { name: 'file2.ts', type: 'file', size: 2048 },
        { name: 'subdir', type: 'directory', size: 0 },
      ],
      path,
      recursive,
      count: 3,
    }
  },
  readOnly: true,
  streaming: false,
  timeoutMs: 10000,
}

/** Web fetch tool */
export const webFetchTool: ToolDefinition = {
  name: 'web_fetch',
  description: 'Fetch content from a URL',
  category: 'network',
  permissions: ['read'],
  schema: {
    type: 'object',
    properties: {
      url: {
        type: 'string',
        description: 'URL to fetch',
      },
      method: {
        type: 'string',
        description: 'HTTP method',
        default: 'GET',
      },
      headers: {
        type: 'object',
        description: 'HTTP headers',
      },
    },
    required: ['url'],
  },
  execute: async (args, context) => {
    const { url, method = 'GET', headers = {} } = args as {
      url: string
      method?: string
      headers?: Record<string, string>
    }

    // In a real implementation, this would fetch the URL
    // For now, return a mock result
    return {
      status: 200,
      statusText: 'OK',
      headers: { 'content-type': 'text/html' },
      body: `Content from ${url}`,
      url,
      method,
    }
  },
  readOnly: true,
  streaming: false,
  timeoutMs: 30000,
}

/** Todo write tool */
export const todoWriteTool: ToolDefinition = {
  name: 'todo_write',
  description: 'Write a todo list',
  category: 'task',
  permissions: ['write'],
  schema: {
    type: 'object',
    properties: {
      todos: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            content: { type: 'string' },
            status: { type: 'string', enum: ['pending', 'in_progress', 'completed'] },
          },
        },
        description: 'List of todo items',
      },
    },
    required: ['todos'],
  },
  execute: async (args, context) => {
    const { todos } = args as { todos: Array<{ content: string; status: string }> }

    // In a real implementation, this would write the todo list
    // For now, return a mock result
    return {
      success: true,
      count: todos.length,
      timestamp: new Date().toISOString(),
    }
  },
  readOnly: false,
  streaming: false,
  timeoutMs: 10000,
}

/** All example tools */
export const exampleTools: ToolDefinition[] = [
  readFileTool,
  writeFileTool,
  bashTool,
  globTool,
  grepTool,
  lsTool,
  webFetchTool,
  todoWriteTool,
]

/** Register all example tools */
export function registerExampleTools(ctx: Context): void {
  const toolRegistry = ctx.toolRegistry

  for (const tool of exampleTools) {
    toolRegistry.register(tool)
  }
}

/**
 * Create example tools plugin.
 * @returns the Cordis plugin.
 */
export function createExampleToolsPlugin(): {
  name: string
  inject: string[]
  apply: (ctx: Context) => void
} {
  return {
    name: 'example-tools',
    inject: ['toolRegistry'],
    apply(ctx) {
      registerExampleTools(ctx)
    },
  }
}
