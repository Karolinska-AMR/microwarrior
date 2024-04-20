$(document).ready(function () {

    let repo = {};
    let search_repo = {};
    let meta = {};
    var selected_drug_index;
    var selected_sample;

    init();


    function init() {

        fetch_meta();
        adjust_viewbar();

        var pinnedIDs = getCookie('pinnedIDs');

        if (!!pinnedIDs && pinnedIDs.length > 0) {
            let urlparams = {
                ids: pinnedIDs,
            };
            fetchSamples(urlparams, true);
        }
        // Run this script when the page loads
        window.onload = function () {
            const urlParams = new URLSearchParams(window.location.search);
            const paramValue = urlParams.get('ticket');
            if (paramValue) {
                let urlparams = {
                    tkt: paramValue,
                };
                fetchSamples(urlparams, true);
            }
        };

        $(window).resize(adjust_viewbar);

        const umu_tbl = document.getElementById('umu-tbl');
        $(umu_tbl).bootstrapTable('destroy');
        $(umu_tbl).bootstrapTable({
            formatNoMatches: function () {
                return '<i class="fas fa-info"></i> No unverified mutations were identified.';
            }

        });

        $("#search-btn").click(function () {
            let formData = {
                tkt: $("#ticketId").val(),
                sid: $("#sampleId").val(),
                wn: $("#weekNumber").val(),
                dtf: $("#dateFrom").val(),
                dtt: $("#dateTo").val(),
                lin: $("#lineage").val(),
                rmu: $("#mutation").val(),
                drg: $("#drug").val(),
                rca: $("#resistanceCategory").val()
            };
            let allFieldsEmpty = Object.values(formData).every(function (value) {
                return value === null || value.trim() === '';
            });

            if (allFieldsEmpty) {
                search_alert('Please fill in at least one field.');

            } else {
                const search_tbl = document.getElementById('search-tbl');
                $(search_tbl).bootstrapTable('showLoading');
                fetchSamples(formData);
            }

        });

        $("#cls-form").click(function () {
            document.getElementById('searchForm').reset();
        });

        $("#del-all").click(function () {
            const search_tbl = document.getElementById('search-tbl');
            $(search_tbl).bootstrapTable("removeAll");
            search_repo = {}
        });

        $("#import-all").click(function () {
            const search_tbl = document.getElementById('search-tbl');
            const d = $(search_tbl).bootstrapTable("getData");
            if (d.length > 0) {
                $.extend(repo, search_repo);
                clean_search();
                update_viewbar();
            } else {
                search_alert("Please search and retrieve at least one sample.");
            }
        });

        $("#del-samples").click(function () {

            const list = document.getElementById('samples-list');
            const items = list.querySelectorAll('.list-group-item'); // Select all list items

            items.forEach(item => {
                $(item).removeClass('active');
                if (!item.classList.contains('pinned-item')) {
                    let id = $(item).attr('data-sid');
                    list.removeChild(item);
                    delete repo[id];
                }
            });

            $("#content-main").css('visibility', 'hidden');
            $("#empty_msg").css('display', 'block');

            selected_sample = undefined;
            selected_drug_index = undefined;
        });

        $("#import-sel").click(function () {
            const search_tbl = document.getElementById('search-tbl');
            const d = $(search_tbl).bootstrapTable("getData");
            let rm_idx = [];
            if (d.length > 0) {
                $.each(d, function (idx, v) {
                    if (v.state === true) {
                        if (v.id in repo) {
                            return;
                        }
                        repo[v.id] = search_repo[v.id];
                        rm_idx.push(idx);
                    }
                });
                $(search_tbl).bootstrapTable("remove", {field: '$index', values: rm_idx});

                update_viewbar();
            } else {
                search_alert("Please search and retrieve at least one sample.");
            }
        });

        $("#searchModal").on("hide.bs.modal", function (event) {
            clean_search();
        });

        $("#toggle-pin-all").click(function () {
            const isUnpinning = $(this).hasClass('unpin-btn');
            $(this).toggleClass('pin-btn unpin-btn');
            $('#samples-list .list-group-item').each(function () {
                toggle_pin_item($(this), isUnpinning);
            });

        });
    }

    function adjust_viewbar() {
        $('#viewbar').css('height', $(window).height()).css('max-height', $(window).height());
    }

    function clean_search() {
        const search_tbl = document.getElementById('search-tbl');
        $(search_tbl).bootstrapTable("removeAll");
        search_repo = {};
        document.getElementById('searchForm').reset();
    }

    function search_alert(message) {
        $("#alertPlaceholder").html(`<div id="search-alert" class="alert alert-danger alert-dismissible fade show" role="alert">
                             <i class="fas fa-exclamation-circle "></i> ${message}
                                 </div>`).show();

        setTimeout(function () {
            const el = document.getElementById('search-alert');
            var bsAlert = new bootstrap.Alert(el);
            bsAlert.close();
        }, 3000);
    }

    function fetch_meta() {
        var xhr = new XMLHttpRequest();
        xhr.open('GET', '/get-meta/', true);

        xhr.onload = function () {
            if (xhr.status >= 200 && xhr.status < 300) {
                // Parse the response JSON
                meta = JSON.parse(xhr.responseText);
            } else {
                console.error('Error fetching samples:', xhr.statusText);
            }
        };
        xhr.onerror = function () {
            console.error('Network error');
        };

        xhr.send();
    }

    function fetchSamples(params, direct_import = false) {

        let queryString = Object.entries(params).map(([k, v]) => `${k}=${v}`).join('&');

        var xhr = new XMLHttpRequest();
        xhr.open('GET', '/get-samples/?' + queryString, true);

        xhr.onload = function () {
            if (xhr.status >= 200 && xhr.status < 300) {
                // Parse the response JSON
                search_repo = JSON.parse(xhr.responseText);

                let infoArray = $.map(search_repo, function (value, key) {
                    return value.info;
                });
                if (infoArray.length === 0) {
                    search_alert('No Matches Found.');
                }
                const search_tbl = document.getElementById('search-tbl');
                $(search_tbl).bootstrapTable('hideLoading');
                document.getElementById('searchForm').reset();
                update_search_tbl(infoArray);
                if (direct_import) {
                    $("#import-all").trigger("click");
                }
            } else {
                const search_tbl = document.getElementById('search-tbl');
                $(search_tbl).bootstrapTable('hideLoading');
                search_alert('Error fetching samples: ' + xhr.statusText);
                // console.error('Error fetching samples:', xhr.statusText);
            }
        };

        xhr.onerror = function () {
            console.error('Network error');
        };

        xhr.send();
    }

    function update_search_tbl(data) {
        const search_tbl = document.getElementById('search-tbl');
        $(search_tbl).bootstrapTable("removeAll");
        data.forEach((d) => {
            $(search_tbl).bootstrapTable("insertRow", {index: 0, row: d});
        });
    }

    function update_viewbar() {

        const pinnedIDs = getCookie('pinnedIDs') ? getCookie('pinnedIDs').split(',') : [];

        let data = $.map(repo, (value) => value.info);

        const sampleList = document.getElementById('samples-list');
        sampleList.innerHTML = '';

        // Sort data based on the 'name' property
        data.sort((a, b) => (a.name > b.name) ? 1 : (a.name < b.name) ? -1 : 0);

        const fragment = document.createDocumentFragment();
        const topFragment = document.createDocumentFragment();  // Fragment for pinned items
        const bottomFragment = document.createDocumentFragment();

        data.forEach(d => {
            const listItem = document.createElement('li');
            listItem.className = 'list-group-item d-flex justify-content-between align-items-center list-group-item-light';
            $(listItem).attr('data-sid', d.id);
            listItem.innerHTML = `
            <div class="info-tag">
                <div class="strong">${d.sample}</div>
                <div class="lin-info text-muted small">${d.lineage.family}</div>
            </div>
            <a class="pin-btn"><i class="fas fa-sm fa-thumbtack"></i></a>`;

            // Set category class
            let cat = d.category || 'cat-other';
            $(listItem).addClass(`border-left-${cat.toLowerCase()}`);

            // Add event listeners
            listItem.querySelector('.pin-btn').addEventListener('click', sample_pin_clicked);
            listItem.addEventListener('click', sample_clicked);

            // Determine placement based on cookie
            if (pinnedIDs.includes(d.id.toString())) {
                $(listItem).addClass('pinned-item');
                $(listItem).find('.pin-btn').toggleClass('pin-btn unpin-btn');

                // Toggle information visibility and classes based on pinning/unpinning
                $(listItem).find('.lin-info').toggle(false);
                $(listItem).find('.info-tag').toggleClass('pinned-info', true);

                topFragment.appendChild(listItem);

            } else {
                bottomFragment.appendChild(listItem);
            }

        });

        // Append all the items at once
        fragment.appendChild(topFragment);
        fragment.appendChild(bottomFragment);
        sampleList.appendChild(fragment);

        let hasPinnedItems = $('#samples-list .pinned-item').length > 0;
        $("#toggle-pin-all").removeClass(hasPinnedItems ? 'pin-btn' : 'unpin-btn')
            .addClass(hasPinnedItems ? 'unpin-btn' : 'pin-btn');


    }


    function sample_clicked() {
        $("#content-main").css('visibility', 'visible');
        $("#empty_msg").css('display', 'none');
        $('.list-group-item').removeClass('active');
        $(this).addClass('active');
        let sid = $(this).data('sid');
        $("#isolate-id").html(`<i class="fas fa-info-circle"></i>
                                Currently Displayed: 
                                <span class="h5 text-${repo[sid].info.category.toLowerCase()}"> ${repo[sid].info.sample}</span>`);
        update_table_loading('showLoading');
        setTimeout(function () {
            if (!repo[sid].dcheck) {
                fetch_mutations(sid);
            } else {
                update_page(sid);
            }
        }, 500);
    }

    function sample_pin_clicked(event) {

        event.stopPropagation(); // Move to the top as a single call

        toggle_pin_item($(this).closest('.list-group-item'));

    }

    function toggle_pin_item($listItem, isUnpinning = null) {

        const $pinbtn = $listItem.find('a');

        if (isUnpinning === null) {
            isUnpinning = $pinbtn.hasClass('unpin-btn');
        }
        // Toggle button classes
        $pinbtn.removeClass(isUnpinning ? 'unpin-btn' : 'pin-btn').addClass(isUnpinning ? 'pin-btn' : 'unpin-btn');

        // Toggle information visibility and classes based on pinning/unpinning
        $listItem.find('.lin-info').toggle(isUnpinning);
        $listItem.find('.info-tag').toggleClass('pinned-info', !isUnpinning);

        // Animating and moving the item
        $listItem.slideUp(300, function () {
            if (isUnpinning) {
                let $nonPinnedItems = $('#samples-list .list-group-item:not(.pinned-item)');
                if ($nonPinnedItems.length > 0) {
                    $nonPinnedItems.first().before($listItem);
                } else {
                    $('#samples-list').append($listItem);
                }
            } else {
                $('#samples-list').prepend($listItem);
            }
            $listItem.toggleClass('pinned-item', !isUnpinning);
            $listItem.slideDown(300);
            savePinnedIdsToCookie();

            let hasPinnedItems = $('#samples-list .pinned-item').length > 0;
            $("#toggle-pin-all").removeClass(hasPinnedItems ? 'pin-btn' : 'unpin-btn')
                .addClass(hasPinnedItems ? 'unpin-btn' : 'pin-btn');
        });


    }

    function savePinnedIdsToCookie() {
        // Select all pinned items and map their data-id attributes to an array
        var pinnedIds = $('.pinned-item').map(function () {
            return $(this).data('sid');
        }).get();

        // Convert array to a string
        var idsString = pinnedIds.join(',');

        // Set the cookie with the string of IDs, with an expiration of 7 days
        setCookie('pinnedIDs', idsString, 7);
    }

    function setCookie(name, value, days) {
        var expires = "";
        if (days) {
            var date = new Date();
            date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
            expires = "; expires=" + date.toUTCString();
        }
        document.cookie = name + "=" + (value || "") + expires + "; path=/";
    }

    function getCookie(name) {
        var nameEQ = name + "="; // Construct a search pattern
        var ca = document.cookie.split(';'); // Split the cookie string into an array of "name=value" pairs

        for (var i = 0; i < ca.length; i++) {
            var c = ca[i];
            while (c.charAt(0) === ' ') c = c.substring(1, c.length); // Trim leading whitespace
            if (c.indexOf(nameEQ) === 0) {
                return c.substring(nameEQ.length, c.length); // Extract and return the value
            }
        }
        return null; // Return null if the cookie is not found
    }

    function update_table_loading(status) {
        let tables = ['lin-tbl', 'prd-tbl', 'umu-tbl'];
        tables.forEach((tn) => {
            const tbl = document.getElementById(tn);
            $(tbl).bootstrapTable(status);
        });
    }

    function fetch_mutations(sample_id) {
        //
        var sids = [sample_id];
        var queryString = sids.map(function (sid) {
            return 'sids=' + encodeURIComponent(sid);
        }).join('&');

        var xhr = new XMLHttpRequest();
        xhr.open('GET', '/get-mutations/?' + queryString, true);
        xhr.onload = function () {
            if (xhr.status >= 200 && xhr.status < 300) {
                // Parse the response JSON
                var data = JSON.parse(xhr.responseText);
                $.each(data, function (sampleId, details) {
                    if (repo[sampleId]) {
                        $.extend(repo[sampleId], details);
                        repo[sampleId]["dcheck"] = true;
                    }
                });
                update_page(sample_id);


            } else {
                console.error('Error fetching samples:', xhr.statusText);
            }
        };

        xhr.onerror = function () {
            console.error('Network error');
        };

        xhr.send();
    }

    function update_page(sid) {
        // Data shortcuts
        let data = repo[sid];

        let drug_cols = [];
        let preds = data['predictions'];
        let mutations = data['mutations'];
        let unverif_mutations = data['unverified_mutations'];
        let drugs = Object.keys(preds);

        // reset some indexes and tables
        selected_drug_index = -1;
        selected_sample = sid;
        reset_evidence();

        //meta-data
        fill_metadata(data.info);
        // Lineage
        const lin_tbl = document.getElementById('lin-tbl');
        $(lin_tbl).bootstrapTable("removeAll");
        $(lin_tbl).bootstrapTable("insertRow", {index: 0, row: data.info.lineage});

        const prd_tbl = document.getElementById('prd-tbl');
        $(prd_tbl).bootstrapTable("destroy");

        if (drugs.length === 0) {
            $(prd_tbl).bootstrapTable({
                formatNoMatches: function () {
                    return '<i class="fas fa-info"></i> No Resistance or Uncertain mutations were detected.';
                }
            });
        } else {
            // Define same sort based on line of drug
            drugs.sort(function (a, b) {
                return meta.drugs.indexOf(a) - meta.drugs.indexOf(b);
            });
            drug_cols.push({field: "cat", title: "Pred./Catalogues"});
            $.each(drugs, function (_, v) {
                drug_cols.push({
                    field: v,
                    title: v.charAt(0).toUpperCase() + v.slice(1),
                });
            });

            $(prd_tbl).bootstrapTable({columns: drug_cols});

            let rows = [{cat: "<span class=''>Predictions</span>"}, {cat: ""}];
            meta.catalogs.forEach((d) => {
                rows.push({'cat': d});
            });


            drugs.forEach((d) => {

                rows[0][d] = parse_prediction(preds[d]);
                rows[1][d] = '';
                let idx = 2;
                meta.catalogs.forEach((c) => {
                    rows[idx][d] = parse_cataloge(mutations[d], c);
                    idx++;

                });
            });
            rows.reverse().forEach((r) => {
                $(prd_tbl).bootstrapTable("insertRow", {index: 0, row: r});
            });

            let tbl_rows = prd_tbl.querySelectorAll('tr');
            let idx = 0;
            tbl_rows.forEach((r) => {
                if (idx === 2) {
                    r.classList.add('table-secondary');
                }
                if (idx > 2) {
                    r.classList.add('table-light');
                }
                idx++;
            });

            function select_column(index, class_names = "") {
                if (index === 0) return;
                $('#prd-tbl tr').each(function () {
                    if ($(this).data('index') !== 1) {
                        $(this).find('th').eq(index).addClass(`col-highlight-header ${class_names}`);
                        $(this).find('td').eq(index).addClass(`col-highlight ${class_names}`);
                    }
                });
            }

            function deselect_column(index, class_names = "") {
                if (index === 0) return;
                $('#prd-tbl tr').each(function () {
                    $(this).find('th').eq(index).removeClass(`col-highlight-header ${class_names}`);
                    $(this).find('td').eq(index).removeClass(`col-highlight ${class_names}`);
                });
            }

            $('#prd-tbl th, #prd-tbl td').mouseenter(function () {
                // Mouse enters the cell
                select_column($(this).index());

            }).mouseleave(function () {
                    // Mouse leaves the cell
                    let index = $(this).index();
                    if (index !== selected_drug_index) {
                        deselect_column(index);
                    }
                }
            ).click(function () {
                let index = $(this).index();
                if (selected_drug_index > 0) {
                    deselect_column(selected_drug_index, 'shadow-lg');
                }
                if (selected_drug_index === index) {
                    selected_drug_index = -1;
                    reset_evidence();

                } else {
                    selected_drug_index = index;
                    select_column(index, 'shadow-lg');
                    let drug = $('#prd-tbl thead th').eq(index).data('field');
                    fill_evidence(drug);
                }
            });
        }
        fill_unverified_mu(unverif_mutations);
        update_table_loading('hideLoading');
    }

    function fill_metadata(data) {
        $('#info-sid').text(data.sample || 'N/A');
        $('#info-tkt').text(data.ticket || 'N/A');
        $('#info-sdt').text(data.submission_timestamp || 'N/A');
        $('#info-cldt').text(data.collection_date || 'N/A');
        $('#info-depth').text(data.genome_depth || 'N/A');
        $('#info-mread').text(data.mapped_reads || 'N/A');
        $('#info-pread').text(data.mapped_reads_pct + '%' || 'N/A');
    }

    function fill_evidence(drug) {

        let evidence = repo[selected_sample]['evidence'][drug];
        if (!evidence) {
            reset_evidence();
            return;
        }
        $("#evidence_row").css("display", "block");
        const evd_tbl = document.getElementById('evd-tbl');
        $(evd_tbl).bootstrapTable("removeAll");
        let color_mapper = {'R': 'text-r', 'U': 'text-u'};
        evidence.forEach((r) => {
            let cl = r.pred ? color_mapper[r.pred] : 'text-o';
            r.pred_icon = `<span class="${cl}"><i class="fas fa-circle"></i></span>`;
            r.OR = r.OR === -999 ? '&#8734;' : r.OR;
            $(evd_tbl).bootstrapTable("insertRow", {index: 0, row: r});
        });


    }

    function fill_unverified_mu(mutations) {
        if (!mutations) {
            return;
        }
        const umu_tbl = document.getElementById('umu-tbl');
        $(umu_tbl).bootstrapTable("removeAll");
        let color_mapper = {'R': 'text-r', 'U': 'text-u'};
        mutations.forEach((r) => {
            let cl = r.pred ? color_mapper[r.pred] : 'text-o';
            r.pred_icon = `<span class="${cl}"><i class="fas fa-circle"></i></span>`;
            r.OR = r.OR === -999 ? '&#8734;' : r.OR;
            $(umu_tbl).bootstrapTable("insertRow", {index: 0, row: r});
        });
    }

    function reset_evidence() {
        $("#evidence_row").css("display", "none");
        const evd_tbl = document.getElementById('evd-tbl');
        $(evd_tbl).bootstrapTable("removeAll");
    }

    function parse_prediction(pred) {

        let color_mapper = {'R': 'text-r', 'U': 'text-u'};
        let header_icon = document.createElement('div');
        header_icon.className = 'row';
        let flexContainer = document.createElement('div');
        flexContainer.className = 'd-flex justify-content-evenly';
        let info = repo[selected_sample]["info"];
        // Iterate over the icons array and create each icon
        meta.catalogs.forEach(function (cat) {
            let isErrorCondition = (!info["pass_cryptic"] && cat.startsWith("CRyPTIC")) ||
                (!info["pass_tbprofiler"] && cat.startsWith("TB")) || (!info["pass_who"] && cat.startsWith("WHO"));

            let pred_cat = pred[cat];
            let link = document.createElement('a');
            link.className = `cat-circle ${pred_cat ? color_mapper[pred_cat] : 'text-o'}`;

            link.setAttribute('title', cat);
            link.innerHTML = isErrorCondition ? `<i class="fas fa-question"></i>` : `<i class="fas fa-circle"></i>`;
            flexContainer.appendChild(link);

        });

        // Append the flex container to the first row
        header_icon.appendChild(flexContainer);

        // Create the second row with the text final prediction
        let countR = Object.values(pred).filter(value => value === "R").length;

        let row2 = document.createElement('div');
        row2.className = 'row';
        let pf = pred['final_pred'];
        let text_color = pf ? color_mapper[pf] : 'text-o';
        // specifying only one cataloge is R
        if (countR === 2) {
            text_color = 'text-pattern-r';
        }
        row2.innerHTML = `<span class="text-center text-outlined ${text_color}">${pf}</span>`;

        let hr = document.createElement('hr');
        hr.className = 'p-0 m-0';

        // Append the rows to the container
        var container = document.createElement('div');
        container.appendChild(row2);
        container.appendChild(hr);
        container.appendChild(header_icon);

        return $(container).prop('outerHTML');
    }

    function parse_cataloge(mutations_drug, catalog) {

        let mutations = mutations_drug[catalog];
        let info = repo[selected_sample]["info"];
        if (!mutations) {

            let isErrorCondition = (!info["pass_cryptic"] && catalog.startsWith("CRyPTIC")) ||
                (!info["pass_tbprofiler"] && catalog.startsWith("TB")) || (!info["pass_who"] && catalog.startsWith("WHO"));

            if (isErrorCondition) {
                return `<span class="text-secondary" title="Could not assess this catalogue due to errors in the pipeline.">
                           <i class="far fa-question-circle"></i>
                        </span>`;
            }
            return `<span class="text-secondary">-</span>`;

        }
        mutations.sort(function (a, b) {
            return a - b;
        });
        let mu_tags = [];
        mutations.forEach((mu) => {
                let cl = mu.pred === "R" ? "text-r" : "text-u";
                if (mu.format === 'GARC1') {
                    mu_tags.push(`<p class='${cl} text-mutation m-0 p-0'>${mu.gene}@${mu.variant}</p>`);
                } else {
                    let bg_cl;
                    if (mu.freq >= 0.8) {
                        bg_cl = "badge-success";
                    } else if (mu.freq >= 0.5) {
                        bg_cl = "badge-warning";
                    } else {
                        bg_cl = "badge-danger";
                    }
                    let badge = `<span class="badge rounded-pill opacity-75 ${bg_cl}" title="Depth: ${mu.depth}">${mu.freq} <span class="visually-hidden">Frequency</span></span>`;
                    mu_tags.push(`<p class='text-mutation ${cl} small text-mutated m-0 p-0'>${mu.gene}@${mu.variant} ${badge}</p>`);
                }
            }
        )
        ;

        return mu_tags.join("");

    }


});