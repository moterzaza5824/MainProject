import { getRepository } from "./repository";
export async function listAssignments() { return (await (await getRepository()).snapshot()).assignments; }
