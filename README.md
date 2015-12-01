To run tests continuously:
./node_modules/.bin/jasmine-node spec --autotest --watch lib

To debug tests with IDE:
node --debug-brk node_modules/jasmine-node/lib/jasmine-node/cli.js spec/codec_spec.js
node --debug-brk node_modules/jasmine-node/lib/jasmine-node/cli.js spec/infinispan_local_spec.js

And then start a remote Node.js debugger from IDE on port 5858.