const assert = require("node:assert/strict");
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const yazl = require("yazl");

const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "opencode-projects-"));
process.env.PROJECTS_DIR = workspace;
const { extractProject, listProjects, safeProjectPath } = require("./project-manager");

function createZip(entries) {
  const filename = path.join(os.tmpdir(), `opencode-upload-${Date.now()}-${Math.random()}.zip`);
  return new Promise((resolve, reject) => {
    const zip = new yazl.ZipFile();
    const output = fs.createWriteStream(filename);
    output.on("close", () => resolve(filename));
    output.on("error", reject);
    for (const entry of entries) {
      zip.addBuffer(Buffer.from(entry.content || ""), entry.name, entry.options);
    }
    zip.end();
    zip.outputStream.pipe(output);
  });
}

test.after(async () => {
  await fsp.rm(workspace, { recursive: true, force: true });
});

test("extracts a common single-root Android ZIP as one project", async () => {
  const zip = await createZip([
    { name: "downloaded-project/index.html", content: "<h1>Hello</h1>" },
    { name: "downloaded-project/src/app.js", content: "console.log('ready')" },
  ]);
  await extractProject(zip, "android-project");
  assert.equal(await fsp.readFile(path.join(workspace, "android-project", "index.html"), "utf8"), "<h1>Hello</h1>");
  assert.equal(await fsp.readFile(path.join(workspace, "android-project", "src", "app.js"), "utf8"), "console.log('ready')");
  assert.deepEqual(await listProjects(), ["android-project"]);
  await fsp.rm(zip, { force: true });
});

test("does not overwrite an existing project", async () => {
  const zip = await createZip([{ name: "index.txt", content: "replacement" }]);
  await assert.rejects(extractProject(zip, "android-project"), /already exists/);
  assert.equal(await fsp.readFile(path.join(workspace, "android-project", "index.html"), "utf8"), "<h1>Hello</h1>");
  await fsp.rm(zip, { force: true });
});

test("rejects unsafe project names", () => {
  assert.equal(safeProjectPath("../outside"), null);
  assert.equal(safeProjectPath("project/name"), null);
  assert.equal(safeProjectPath("safe-project"), path.join(workspace, "safe-project"));
});
