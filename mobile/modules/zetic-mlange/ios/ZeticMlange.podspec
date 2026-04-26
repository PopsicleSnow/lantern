require 'json'

package = JSON.parse(File.read(File.join(__dir__, '..', 'package.json')))

# NOTE: ZeticMLange iOS SDK (1.6.0) is distributed via Swift Package Manager only.
# After running `expo prebuild`, open the generated Xcode workspace and add the SPM
# package: https://github.com/zetic-ai/ZeticMLangeiOS.git pinned to 1.6.0.
# Documented in mobile/README.md.
Pod::Spec.new do |s|
  s.name           = 'ZeticMlange'
  s.version        = package['version']
  s.summary        = package['description']
  s.license        = 'MIT'
  s.author         = 'Lantern'
  s.homepage       = 'https://lantern.local'
  s.platforms      = { ios: '15.1', tvos: '15.1' }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
