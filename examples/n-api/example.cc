#include <node_api.h>

#include <chrono>
#include <thread>

namespace example {

#define NAPI_CALL(env, call)                                      \
  do {                                                            \
    napi_status status = (call);                                  \
    if (status != napi_ok) {                                      \
      const napi_extended_error_info* error_info = NULL;          \
      napi_get_last_error_info((env), &error_info);               \
      bool is_pending;                                            \
      napi_is_exception_pending((env), &is_pending);              \
      if (!is_pending) {                                          \
        const char* message = (error_info->error_message == NULL) \
            ? "empty error message"                               \
            : error_info->error_message;                          \
        napi_throw_error((env), NULL, message);                   \
        return NULL;                                              \
      }                                                           \
    }                                                             \
  } while(0)

// The Run function provides the implementation of the worker.
// info argument will contain the input arguments. To perform
// work asynchronously, this must return a Promise.
static napi_value Run(napi_env env, napi_callback_info info) {
  // Artificially block the thread, simulating block activity
  std::this_thread::sleep_for(std::chrono::seconds(1));
  napi_value result;
  NAPI_CALL(env,
    napi_create_string_latin1(env, "Hello World", NAPI_AUTO_LENGTH, &result));
  return result;
}

NAPI_MODULE_INIT() {
  napi_value result;
  NAPI_CALL(env,
    napi_create_function(env, "run", NAPI_AUTO_LENGTH, Run, NULL, &result));
  return result;
}
}  // namespace example
