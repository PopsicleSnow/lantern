import ExpoModulesCore
import Foundation
import ZeticMLange

// Bridges the ZETIC.MLange iOS SDK (1.6.0) into Expo modules. JS sends tensors as
// { shape: [Int], dtype: "int32"|"int64"|"float32", data: base64 }.
//
// The exact Tensor constructor on the SDK may vary between minors. This module uses
// the documented (data: Data, shape: [Int], dataType: DataType) constructor; if your
// SDK exposes a different surface, update buildTensor / extractTensor below.
public class ZeticMlangeModule: Module {
  private var models: [String: ZeticMLangeModel] = [:]
  private let queue = DispatchQueue(label: "lantern.zetic.models", attributes: .concurrent)

  public func definition() -> ModuleDefinition {
    Name("ZeticMlangeModule")

    AsyncFunction("loadModel") { (personalKey: String, modelName: String, version: Int?, modelMode: String) -> String in
      let mode: ModelMode
      switch modelMode.uppercased() {
      case "SPEED": mode = .RUN_SPEED
      case "ACCURACY": mode = .RUN_ACCURACY
      default: mode = .RUN_AUTO
      }
      let model = try ZeticMLangeModel(
        personalKey: personalKey,
        name: modelName,
        version: version as NSNumber?,
        modelMode: mode,
        onDownload: { _ in }
      )
      let handle = UUID().uuidString
      self.queue.async(flags: .barrier) { self.models[handle] = model }
      return handle
    }

    AsyncFunction("runModel") { (handle: String, inputs: [[String: Any]]) -> [[String: Any]] in
      var modelOpt: ZeticMLangeModel?
      self.queue.sync { modelOpt = self.models[handle] }
      guard let model = modelOpt else {
        throw NSError(
          domain: "ZeticMlange",
          code: 1,
          userInfo: [NSLocalizedDescriptionKey: "Unknown model handle: \(handle)"]
        )
      }

      let tensorInputs: [Tensor] = try inputs.map(self.buildTensor)
      let outputs: [Tensor] = try model.run(tensorInputs)
      return outputs.map(self.extractTensor)
    }

    AsyncFunction("releaseModel") { (handle: String) -> Bool in
      var removed = false
      self.queue.async(flags: .barrier) {
        if self.models.removeValue(forKey: handle) != nil { removed = true }
      }
      return removed
    }
  }

  private func buildTensor(_ dict: [String: Any]) throws -> Tensor {
    guard let dtype = (dict["dtype"] as? String)?.lowercased() else {
      throw NSError(domain: "ZeticMlange", code: 2, userInfo: [NSLocalizedDescriptionKey: "Missing dtype"])
    }
    guard let shapeAny = dict["shape"] as? [Any] else {
      throw NSError(domain: "ZeticMlange", code: 3, userInfo: [NSLocalizedDescriptionKey: "Missing shape"])
    }
    let shape: [Int] = shapeAny.compactMap { ($0 as? NSNumber)?.intValue }
    guard let b64 = dict["data"] as? String, let data = Data(base64Encoded: b64) else {
      throw NSError(domain: "ZeticMlange", code: 4, userInfo: [NSLocalizedDescriptionKey: "Invalid data"])
    }
    let dataType: DataType
    switch dtype {
    case "int32": dataType = .INT32
    case "int64": dataType = .INT64
    case "float32": dataType = .FLOAT32
    default:
      throw NSError(domain: "ZeticMlange", code: 5, userInfo: [NSLocalizedDescriptionKey: "Unsupported dtype: \(dtype)"])
    }
    return Tensor(data: data, shape: shape, dataType: dataType)
  }

  private func extractTensor(_ t: Tensor) -> [String: Any] {
    let dtype: String
    switch t.dataType {
    case .INT32: dtype = "int32"
    case .INT64: dtype = "int64"
    case .FLOAT32: dtype = "float32"
    default: dtype = "float32"
    }
    return [
      "shape": t.shape,
      "dtype": dtype,
      "data": t.data.base64EncodedString()
    ]
  }
}
