cd basic;
  # generate .noda files
  for dir in $(ls -d */); do
    zip -r -y $(basename $dir).noda $dir;
  done

  # run .js
  for js in $(ls *.js); do
    node $js
  done
 
cd ..;

cd resources;
  # generate .noda files
  for dir in $(ls -d */); do
    zip -r -y $(basename $dir).noda $dir;
  done

  # run .js
  for js in $(ls *.js); do
    node $js
  done
 
cd ..;

cd zip-oddities;
  # generate .noda files
  for dir in $(ls -d */); do
    zip -r -y $(basename $dir).noda $dir;
  done

  # run .js
  for js in $(ls *.js); do
    node $js
  done
 
cd ..;

