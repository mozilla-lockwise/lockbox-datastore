# Lockbox Datastore

<a name="0.2.0"></a>
# 0.2.0

_Date: 2018-01-16_

**NOTE**: This release requires applications to specify an `appKey` when initializing or unlocking.

## What's New

* Rwmoved the default `appKey`.  Consumers of this API _must_ specify an `appKey` when initializing or unlocking the datastore instance.
* Exports the `DataStore` class to allow for extending it.
* Updated various dependencies to their latest versions.

## What's Fixed

_No issues fixed_

<a name="0.1.0"></a>
# 0.1.0

_Date: 2017-12-14_

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

