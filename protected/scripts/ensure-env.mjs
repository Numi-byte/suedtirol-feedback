import { copyFile, access } from "node:fs/promises";
import { constants } from "node:fs";

const localEnvironment = new URL("../.env.local", import.meta.url);
const exampleEnvironment = new URL("../.env.local.example", import.meta.url);

try {
  await access(localEnvironment, constants.F_OK);
} catch {
  await copyFile(exampleEnvironment, localEnvironment, constants.COPYFILE_EXCL);
  console.info(
    "Created protected/.env.local from .env.local.example. Review its Supabase values before signing in.",
  );
}
