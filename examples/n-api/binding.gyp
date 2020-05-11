{
  "targets": [{
    "target_name": "example",
    "include_dirs": [
      "<!(node -e \"require('napi-macros')\")",
      "deps/ngtcp2/includes"
    ],
    "sources": [
      "./example.cc"
    ]
  }]
}
