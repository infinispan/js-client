$(document).ready(function() {
    $('#toctitle').before('<div id="tocheader"><a href="https://infinispan.org/documentation/"><img src="https://infinispan.org/assets/images/infinispan-logo.png" alt="Infinispan"></a></div>');
    $('ul.sectlevel1').wrap('<div id="toctree"></div>');
    var toctree = $('#toctree');
    toctree.jstree({
        "core" : {
            "themes" : {"variant" : "small", "icons" : false}
        },
        "plugins" : [ "search", "wholerow", "state" ]
    }).on("activate_node.jstree", function (e, data) {
        location.href = data.node.a_attr.href;
    });
    toctree.before('<input placeholder="&#xf002; Search" id="tocsearch" type="text">');
    var searchTimeout = false;
    var tocsearch = $('#tocsearch');
    tocsearch.keyup(function () {
        if (searchTimeout) { clearTimeout(searchTimeout); }
        searchTimeout = setTimeout(function () {
            toctree.jstree(true).search(tocsearch.val());
        }, 250);
    });
    tocsearch.after('<a href="#" id="toctreeexpand" title="Expand"><i class="fa fa-plus-square" aria-hidden="true"></i></a><a href="#" id="toctreecollapse" title="Collapse"><i class="fa fa-minus-square" aria-hidden="true"></i></a>');
    $('#toctreeexpand').click(function() { toctree.jstree('open_all'); });
    $('#toctreecollapse').click(function() { toctree.jstree('close_all'); });
});
