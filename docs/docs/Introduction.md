---
sidebar_position: 1
slug: /
---

# Introduction

Piscina.js is a powerful Node.js worker pool library that allows you to efficiently run CPU-intensive tasks in parallel using worker threads. It provides a simple API for offloading computationally expensive tasks to a pool of worker threads, thereby improving the performance and scalability of your Node.js applications.

## Why Piscina?

In the early days of worker threads, the Node.js core team encountered an issue where a user's application was spinning up thousands of concurrent worker threads, leading to performance issues. While this specific issue helped identify a minor memory leak in the worker implementation, it highlighted a broader problem: the misuse of worker threads due to a lack of understanding.

While worker threads have matured and their usage has become more widespread, there is still a need for better examples and education around their correct usage. This realization led to the creation of Piscina, an open-source project sponsored by [NearForm Research](https://www.nearform.com/), focused on providing guidance and best practices for using worker threads in Node.js applications.

With worker threads now a well-established feature in Node.js, Piscina aims to bridge the gap between the potential of worker threads and their practical implementation.

## Key features

✔ Fast communication between threads\
✔ Covers both fixed-task and variable-task scenarios\
✔ Supports flexible pool sizes\
✔ Proper async tracking integration\
✔ Tracking statistics for run and wait times\
✔ Cancellation Support\
✔ Supports enforcing memory resource limits\
✔ Supports CommonJS, ESM, and TypeScript\
✔ Custom task queues\
✔ Optional CPU scheduling priorities on Linux


