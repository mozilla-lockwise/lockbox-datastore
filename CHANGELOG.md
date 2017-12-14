# Lockbox Datastore

<a name="0.1.0"></a>
# 0.1.0

**NOTE**: This release now uses a symmetric key to lock/unlock the datastore, instead of a master password.  Any previous data from a previous instance is now lost.

## What's New

* Lock/unlock the datastore using a 
* Full item validation and completion
* Generate history patches

## What's Fixed

* API documentation is generated correctly, and checked.
* A Datastore can be re-initialized (updated) to use a different symmetric key


<a name="0.0.1"></a>
## 0.0.1

_Date: 2017-10-26_

This is the initial release of Datastore.

### What's New

* Adds, updates, and removes items from the datastore
* Stores items using IndexedDB
* Encrypts items using a master password
* Get a Datastore asynchronously

### Known Issues

* Once initialized, a datastore's password cannot be changed.

