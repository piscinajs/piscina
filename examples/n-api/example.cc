#include <napi.h>

#include <chrono>
#include <thread>

namespace example {

using namespace Napi;

// The Run function provides the implementation of the worker.
// info argument will contain the input arguments. To perform
// work asynchronously, this must return a Promise.
static String Run(const CallbackInfo& info) {
  // Artificially block the thread, simulating block activity
  std::this_thread::sleep_for(std::chrono::seconds(1));
  return String::New(info.Env(), "Hello World");
}

Object Init(Env env, Object exports) {
  return Function::New(env, Run);
}

NODE_API_MODULE(NODE_GYP_MODULE_NAME, Init)

}  // namespace example
