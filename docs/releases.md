# Releasing to NPM

## Checklist

Unlike other projects in Lockbox, this project releases new versions as needed by other projects.

* All finished work is verified to work as expected and committed to `master`
* Engineering ahd PI have voiced approval to release (e.g., via Slack **#lockbox** channel)

## Instructions

**NOTE:** these instructions assume:

* All of the [checklist items](#checklist) are complete
* You are an administrator of the project `lockbox-datastore`
* Your local git working copy has a remote named `upstream` pointing to `git@github.com:mozilla-lockbox/lockbox-datastore.git`

To generate the next release binary:

1. Update "version" in `package.json` (and `package-lock.json`):
    - We follow the [semver](https://semver.org/) syntax
    - _Prerelease_ (prior to _Stable_) have a major version of "0" (e.g., "0.2.0")
    - _Beta_ releases will be labeled with "-beta" and an optional number (e.g., "0.2.0-beta" or "0.2.1-beta3")
    - _Stable_ releases will **not** be albeled, and follow semver starting with "1.0.0"
2. Update `CHANGELOG.md`:
    - The latest release as at the top, under a second-level header
    - Each release includes the sub headings "What's New", "What's Fixed", and "Known Issues"
    - Consult with Product Management for wording if needed.
3. Commit and ultimately merge to `master` branch.
4. Create a pull request on Github [comparing changes from the `master` branch against/to `production`][production-compare]
5. Tag the latest commit on `production` branch with an annotated version and push the tag:
    - `git tag -a -m "Release 0.3.0" 0.3.0`
    - `git push upstream 0.3.0`
    - Travis-CI will build and publish to [NPM]
6. Send an announcement to the team (e.g., via Slack **#lockbox** channel)

[production-compare]: https://github.com/mozilla-lockbox/lockbox-datastore/compare/production...master
[NPM]: https://npmjs.com/linuxwolf/lockbox-datastore

