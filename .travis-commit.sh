#!/bin/sh

setup_git() {
  git config --global user.email "travis@travis-ci.org"
  git config --global user.name "Travis CI"
}

commit_website_files() {
  #git checkout master
  git add docs/*.md
  git commit --message "docs updated from Travis build: $TRAVIS_BUILD_NUMBER"
}

upload_files() {
  git remote add origin-master https://${GH_TOKEN}@github.com/devinreams/lockbox-datastore.git > /dev/null 2>&1
  git push --quiet --set-upstream origin-master
}

setup_git
commit_website_files
upload_files
