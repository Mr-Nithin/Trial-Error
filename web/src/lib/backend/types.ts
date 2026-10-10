import type {
  BranchInput,
  CreateProjectInput,
  CreateRunInput,
  CreateStepInput,
  CreateVersionInput,
  GoalDTO,
  LoginInput,
  MediaDTO,
  MoveStepInput,
  ProjectDTO,
  ProjectSummaryDTO,
  ReplaceGoalsInput,
  RunDTO,
  SignupInput,
  StepDTO,
  UpdateMeInput,
  UpdateProjectInput,
  UpdateStepInput,
  UpdateVersionInput,
  UserDTO,
  VersionDTO,
} from "@shared/api-types";

export interface Backend {
  me(): Promise<UserDTO>;
  signup(input: SignupInput): Promise<UserDTO>;
  login(input: LoginInput): Promise<UserDTO>;
  logout(): Promise<void>;
  updateMe(input: UpdateMeInput): Promise<UserDTO>;

  listProjects(archived: boolean): Promise<ProjectSummaryDTO[]>;
  getProject(id: string): Promise<ProjectDTO>;
  createProject(input: CreateProjectInput): Promise<ProjectDTO>;
  updateProject(id: string, input: UpdateProjectInput): Promise<ProjectDTO>;
  deleteProject(id: string): Promise<void>;
  duplicateProject(id: string): Promise<ProjectDTO>;
  replaceGoals(projectId: string, input: ReplaceGoalsInput): Promise<GoalDTO[]>;

  createVersion(projectId: string, input: CreateVersionInput): Promise<VersionDTO>;
  updateVersion(id: string, input: UpdateVersionInput): Promise<VersionDTO>;
  deleteVersion(id: string): Promise<void>;
  duplicateVersion(id: string): Promise<VersionDTO>;
  branchVersion(id: string, input: BranchInput): Promise<VersionDTO>;

  createStep(versionId: string, input: CreateStepInput): Promise<StepDTO>;
  updateStep(id: string, input: UpdateStepInput): Promise<StepDTO>;
  deleteStep(id: string): Promise<void>;
  moveStep(id: string, input: MoveStepInput): Promise<StepDTO[]>;

  createRun(versionId: string, input: CreateRunInput): Promise<RunDTO>;
  uploadMedia(file: File): Promise<MediaDTO>;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}
