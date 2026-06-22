# Security Policy

## Supported Versions

We prioritize the security of our users and ensure that our library is as secure as possible. Currently, we provide security updates primarily for the latest major version of Piscina. 

Older versions might receive security updates depending on the severity of the vulnerability and the maintainers' bandwidth, but this is not guaranteed.

| Version | Supported          |
| ------- | ------------------ |
| 6.x-rc     | ⚠️ |
| 5.x     | :white_check_mark: |
| 4.x     | :white_check_mark: |
| 3.x     | :x:                |


## Scope & Threat Model

Piscina is a fast, efficient Node.js Worker Thread Pool implementation. Due to the nature of offloading tasks to separate threads, we are particularly interested in vulnerabilities related to:

* **Thread Isolation Bypass:** Cross-thread data leakage or unexpected state sharing between separate worker threads.
* **Arbitrary Code Execution (ACE):** Ability for an attacker to manipulate the `filename` or task execution parameters to run unauthorized code.
* **Denial of Service (DoS):** Exploits capable of locking up the main thread, bypassing `maxQueue` constraints, or exhausting memory resources in ways the library intends to prevent.

## Reporting a Vulnerability

👮 **Responsible Disclosure**

**Do not open public issues that might have security implications.** It is critical that security-related issues are reported privately so we have time to address them before they become public knowledge.

Individuals who find potential vulnerabilities in Piscina are invited to report them privately using the following channels:

1. **GitHub Security Advisories:** You can privately report a vulnerability directly via the [GitHub Security Advisory feature](https://github.com/piscinajs/piscina/security/advisories/new) on the Piscina repository. 

### What to Include in the Report

To help us properly address the issue, please include the following in your report:

- A detailed description of the vulnerability and its potential impact.
- Steps to reproduce the issue (a minimal reproduction repository or code snippet is highly appreciated).
- The version(s) of `piscina` and `Node.js` affected.
- Any potential mitigation or workarounds you might have found.

## Disclosure Policy

When you report a vulnerability, we will strive to follow this process:

1. **Acknowledgement:** We will acknowledge receipt of your vulnerability report within 3 working days.
2. **Triage:** We will triage the issue, confirm the vulnerability, and determine its severity.
3. **Patching:** We will work on a patch to address the vulnerability in a private fork.
4. **Release:** A new version of the package will be released with the patch. 
5. **Public Disclosure:** Once the fix is released, we will publish a public security advisory on GitHub, giving you proper credit for the discovery (unless you prefer to remain anonymous).

We ask that you operate in good faith and refrain from sharing the vulnerability publicly until a fix has been released and the official advisory is published.
