import { ChildProcess } from "child_process";

export interface Process {
  // This promise resolves when the process has exited
  complete: Promise<{
    stdout: string,
    stderr: string
  }>,
  // The process object
  proc: ChildProcess,

  started: Promise<void>
};

export type ProcessessList = Record<string, ChildProcess>;

export interface Action {
  start: (any?) => Promise<void | any>;
  stop?: () => Promise<any | void>;
}
