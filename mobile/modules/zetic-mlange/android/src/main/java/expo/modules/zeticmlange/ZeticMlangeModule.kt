package expo.modules.zeticmlange

import android.util.Base64
import com.zeticai.mlange.ZeticMLangeModel
import com.zeticai.mlange.ModelMode
import com.zeticai.mlange.core.model.Tensor
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap

// Bridges the ZETIC.MLange Android SDK (1.6.x) into Expo modules. JS sends tensors as
// { shape: int[], dtype: "int32"|"int64"|"float32", data: base64 }.
//
// The exact public Tensor constructor on com.zeticai.mlange.core.model.Tensor may vary
// between SDK minors. This module uses the documented (data: ByteArray, shape: IntArray,
// dtype: DataType) constructor; if your SDK exposes a different constructor (e.g. a
// typed factory), update the `buildTensor` and `extractTensor` helpers below.
class ZeticMlangeModule : Module() {
  private val models = ConcurrentHashMap<String, ZeticMLangeModel>()

  override fun definition() = ModuleDefinition {
    Name("ZeticMlangeModule")

    AsyncFunction("loadModel") { personalKey: String, modelName: String, version: Int?, modelMode: String ->
      val context = appContext.reactContext
        ?: throw CodedException("E_NO_CONTEXT", "Android context unavailable", null)
      val mode = when (modelMode.uppercase()) {
        "SPEED" -> ModelMode.RUN_SPEED
        "ACCURACY" -> ModelMode.RUN_ACCURACY
        else -> ModelMode.RUN_AUTO
      }
      val model = if (version != null) {
        ZeticMLangeModel(context, personalKey, modelName, version, mode) { _ -> }
      } else {
        ZeticMLangeModel(context, personalKey, modelName, modelMode = mode) { _ -> }
      }
      val handle = UUID.randomUUID().toString()
      models[handle] = model
      handle
    }

    AsyncFunction("runModel") { handle: String, inputs: List<Map<String, Any>> ->
      val model = models[handle]
        ?: throw CodedException("E_BAD_HANDLE", "Unknown model handle: $handle", null)
      val tensorInputs: Array<Tensor> = inputs.map(::buildTensor).toTypedArray()
      val outputs: Array<Tensor> = model.run(tensorInputs)
      outputs.map(::extractTensor)
    }

    AsyncFunction("releaseModel") { handle: String ->
      val model = models.remove(handle) ?: return@AsyncFunction false
      try {
        model.deinit()
      } catch (_: Throwable) {}
      true
    }
  }

  private fun buildTensor(map: Map<String, Any>): Tensor {
    val dtype = (map["dtype"] as String).lowercase()
    val shapeAny = map["shape"] as List<*>
    val shape = IntArray(shapeAny.size) { (shapeAny[it] as Number).toInt() }
    val dataB64 = map["data"] as String
    val bytes = Base64.decode(dataB64, Base64.NO_WRAP)
    val buffer = ByteBuffer.wrap(bytes).order(ByteOrder.LITTLE_ENDIAN)
    val dataType = when (dtype) {
      "int32" -> Tensor.DataType.INT32
      "int64" -> Tensor.DataType.INT64
      "float32" -> Tensor.DataType.FLOAT32
      else -> throw CodedException("E_DTYPE", "Unsupported dtype: $dtype", null)
    }
    return Tensor(buffer, shape, dataType)
  }

  private fun extractTensor(t: Tensor): Map<String, Any> {
    val buffer = t.buffer
    buffer.order(ByteOrder.LITTLE_ENDIAN)
    val bytes = ByteArray(buffer.remaining())
    buffer.duplicate().get(bytes)
    val dtype = when (t.dataType) {
      Tensor.DataType.INT32 -> "int32"
      Tensor.DataType.INT64 -> "int64"
      Tensor.DataType.FLOAT32 -> "float32"
      else -> "float32"
    }
    return mapOf(
      "shape" to t.shape.toList(),
      "dtype" to dtype,
      "data" to Base64.encodeToString(bytes, Base64.NO_WRAP)
    )
  }
}
