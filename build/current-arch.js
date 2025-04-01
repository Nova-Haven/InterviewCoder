const { execSync } = require("child_process");
const os = require("os");

// Determine current operating system
const platform = os.platform();
// Determine current architecture
const arch = os.arch();

// Map platform and architecture to electron-builder parameters
let buildCommand = "electron-builder build";

switch (platform) {
  case "darwin": // macOS
    const macArch = arch === "arm64" ? "arm64" : "x64";
    console.log(`Building for macOS on ${macArch} architecture`);
    buildCommand += ` --mac --${macArch}`;
    break;

  case "win32": // Windows
    const winArch = arch === "x64" ? "x64" : arch === "ia32" ? "ia32" : "x64";
    console.log(`Building for Windows on ${winArch} architecture`);
    buildCommand += ` --win --${winArch}`;
    break;

  case "linux":
    const linuxArch =
      arch === "x64"
        ? "x64"
        : arch === "arm64"
        ? "arm64"
        : arch === "armv7l"
        ? "armv7l"
        : "x64";
    console.log(`Building for Linux on ${linuxArch} architecture`);
    buildCommand += ` --linux --${linuxArch}`;
    break;

  default:
    console.error(`Unsupported platform: ${platform}`);
    process.exit(1);
}

console.log("Executing build command:", buildCommand);

try {
  // Run electron-builder with the current platform and architecture
  execSync(buildCommand, {
    stdio: "inherit",
  });

  console.log(`Build completed for ${platform} on ${arch} architecture`);
} catch (error) {
  console.error("Build failed:", error);
  process.exit(1);
}
