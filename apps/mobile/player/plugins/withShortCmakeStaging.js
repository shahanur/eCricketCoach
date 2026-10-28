// Windows' 260-char path limit breaks ninja for native modules (react-native-worklets, autolinked
// codegen in :app, ...) because CMake object paths embed the full source path beneath a deep .cxx dir.
// On Windows this plugin:
//  - passes CMAKE_OBJECT_PATH_MAX so CMake hashes over-long object directories, and
//  - redirects each module's CMake staging directory to a short root (override: ANDROID_CXX_STAGING_ROOT).
const { withAppBuildGradle, withProjectBuildGradle } = require('expo/config-plugins');

const MARKER = '// @generated withShortCmakeStaging';
const OBJECT_PATH_MAX = 240;

const shortRootGroovy = `
def shortCxxRoot = System.getenv('ANDROID_CXX_STAGING_ROOT')
if (!shortCxxRoot && System.getProperty('os.name').toLowerCase().contains('windows')) {
  shortCxxRoot = "\${System.getenv('SystemDrive') ?: 'C:'}/cxx/\${rootProject.name.replaceAll('[^A-Za-z0-9]', '')}"
}`;

const configureGroovy = (target) => `
  ${target}.android.externalNativeBuild.cmake.buildStagingDirectory = new File(shortCxxRoot, ${target}.name)
  ${target}.android.defaultConfig.externalNativeBuild.cmake.arguments("-DCMAKE_OBJECT_PATH_MAX=${OBJECT_PATH_MAX}")`;

// :app is evaluated before the root build.gradle body runs, so it is configured from its own script.
const appSnippet = `
${MARKER}
${shortRootGroovy}
if (shortCxxRoot) {${configureGroovy('project')}
}
`;

const rootSnippet = `
${MARKER}
${shortRootGroovy}
if (shortCxxRoot) {
  allprojects { p ->
    if (p.state.executed) return
    p.plugins.withId('com.android.library') {${configureGroovy('p')}
    }
  }
}
`;

const append = (snippet) => (cfg) => {
  if (cfg.modResults.language === 'groovy' && !cfg.modResults.contents.includes(MARKER)) {
    cfg.modResults.contents += snippet;
  }
  return cfg;
};

module.exports = function withShortCmakeStaging(config) {
  config = withProjectBuildGradle(config, append(rootSnippet));
  return withAppBuildGradle(config, append(appSnippet));
};
