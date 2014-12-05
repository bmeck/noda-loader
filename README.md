## Generating a .noda from npm

```
FILE=$(npm pack $mypackage)
tar -xzf $FILE
zip -y -r $mypackage.noda package
```

## If you get errors in your .noda

You most likely want to swap your current fs operation resource operations from the spec.

## Generating a single bootstrapping binary with .noda support

Bear with me.

Checkout node and pull in 2 commits from `github.com:bmeck/node`'s third-party-main branch

```
git clone git@github.com:joyent/node
cd node
  git checkout v0.10
  git remote add bmeck git@github.com:bmeck/node.git
  git fetch bmeck third-party-main
  # expose the --third-party-main configure option (was already in the code lol)
  git cherry-pick 18a842705a427e00d9b80ee4d39f5573f4565847 31d34180feda7a27aee729421eb68c44b7073585
```

Checkout noda-loader and generate our `_third_party_main.js` for node.

```
git clone git@github.com:bmeck/noda-loader
cd noda-loader
  npm i
  cd generate-single-binary
    sh generate-third-party-main.sh > "$PATH_TO_NODE_REPO"/lib/_third_party_main.js
```

Configure and build node

```
./configure --third-party-main && make
```

You now have a working node with `.noda` support.

Concat your `.noda` to the end of the `node` binary you built in order to use it as a bootstrap.
You can check process.mainModule to check if you are the main module.

** NOTE ** This will prevent the repl / debugger / etc. unless you invoke those things yourself.

```
cat ./node myapp.noda > myapp
chmod +x myapp
```
