$(document).ready(function () {

    let repo = {}
    let search_repo = {}
    let meta = {}
    var selected_drug_index;
    var selected_sample;

    init();


    function init() {

        fetch_meta();
        adjust_viewbar();

        $(window).resize(adjust_viewbar);

        const umu_tbl = document.getElementById('umu-tbl');
        $(umu_tbl).bootstrapTable('destroy');
        $(umu_tbl).bootstrapTable({
            formatNoMatches: function () {
                return '<span class="text-dark">No unverified mutations found</span>';
            }
        });

        $("#search-btn").click(function () {
            let formData = {
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
                search_alert('Please fill in at least one field.')

            } else {
                const search_tbl = document.getElementById('search-tbl');
                $(search_tbl).bootstrapTable('showLoading')
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
                search_alert("Please search and retrieve at least one sample.")
            }
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
                        console.log(repo)
                        rm_idx.push(idx)
                    }
                });
                $(search_tbl).bootstrapTable("remove", {field: '$index', values: rm_idx});

                update_viewbar();
            } else {
                search_alert("Please search and retrieve at least one sample.")
            }
        });


        $("#searchModal").on("hide.bs.modal", function (event) {
            clean_search()
        });
    }

    function adjust_viewbar(){
      $('#viewbar').css('height', $(window).height()).css('max-height',$(window).height());
    }

    function clean_search() {
        const search_tbl = document.getElementById('search-tbl');
        $(search_tbl).bootstrapTable("removeAll");
        search_repo = {}
        document.getElementById('searchForm').reset();
    }

    function search_alert(message) {
        $("#alertPlaceholder").html(`<div id="search-alert" class="alert alert-danger alert-dismissible fade show" role="alert">
                             <i class="fas fa-exclamation-circle "></i> ${message}
                                 </div>`).show()

        setTimeout(function () {
            const el = document.getElementById('search-alert')
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

    function fetchSamples(params) {

        let queryString = Object.entries(params).map(([k, v]) => `${k}=${v}`).join('&');
        console.log(queryString)
        var xhr = new XMLHttpRequest();
        xhr.open('GET', '/get-samples/?' + queryString, true);

        xhr.onload = function () {
            if (xhr.status >= 200 && xhr.status < 300) {
                // Parse the response JSON
                search_repo = JSON.parse(xhr.responseText);

                let infoArray = $.map(search_repo, function (value, key) {
                    return value.info;
                });
                const search_tbl = document.getElementById('search-tbl');
                $(search_tbl).bootstrapTable('hideLoading');
                document.getElementById('searchForm').reset();
                update_search_tbl(infoArray);
            } else {
                const search_tbl = document.getElementById('search-tbl');
                $(search_tbl).bootstrapTable('hideLoading');
                search_alert('Error fetching samples: ' + xhr.statusText)
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
            $(search_tbl).bootstrapTable("insertRow", {index: 0, row: d})
        });
    }

    function update_viewbar() {

        let data = $.map(repo, function (value, key) {
            return value.info;
        });

        const sampleList = document.getElementById('samples-list');
        var listItems = sampleList.getElementsByClassName('list-group-item');
        var listItemsArray = Array.from(listItems);

        // Remove all
        listItemsArray.forEach(function (it) {
            sampleList.removeChild(it);
        });

        data.sort((a, b) => (a.name > b.name) ? 1 : (a.name < b.name) ? -1 : 0);
        data.forEach(function (d) {
            // Create list item
            const listItem = document.createElement('li');
            listItem.className = 'list-group-item d-flex justify-content-between align-items-center list-group-item-light';
            $(listItem).attr('data-sid', d.id);
            // Sample name and lineage
            const sampleDiv = document.createElement('div');
            const sampleName = document.createElement('div');
            sampleName.className = 'strong';
            sampleName.textContent = d.sample;

            const sampleLineage = document.createElement('div');
            sampleLineage.className = 'text-muted small';
            sampleLineage.textContent = d.lineage.family; // Assuming lineage always has a family

            sampleDiv.appendChild(sampleName);
            sampleDiv.appendChild(sampleLineage);

            // Category badge
            bg = d.category ? d.category : 'cat-other'
            bg = bg === "other" ? 'cat-other' : bg
            const categoryBadge = document.createElement('span');
            categoryBadge.className = `badge ${bg}`;
            categoryBadge.textContent = d.category;

            // Append to list item
            listItem.appendChild(sampleDiv);
            listItem.appendChild(categoryBadge);

            listItem.addEventListener('click', function () {
                $("#content-main").css('visibility', 'visible')
                $("#empty_msg").css('display', 'none')
                $('.list-group-item').removeClass('active');
                $(this).addClass('active');
                let sid = $(this).data('sid')

                if (!repo[sid].dcheck) {
                    fetch_mutations(sid);
                } else {
                    update_page(sid);
                }


            });
            // Append the list item to the list
            sampleList.appendChild(listItem);


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
        let data = repo[sid]

        console.log(data)

        let drug_cols = []
        let preds = data['predictions']
        let mutations = data['mutations']
        let unverif_mutations = data['unverified_mutations']
        let drugs = Object.keys(preds)

        // reset some indexes and tables
        selected_drug_index = -1;
        selected_sample = sid;
        reset_evidence();


        // Lineage
        const lin_tbl = document.getElementById('lin-tbl')
        $(lin_tbl).bootstrapTable("removeAll");
        $(lin_tbl).bootstrapTable("insertRow", {index: 0, row: data.info.lineage})

        // Define some sort based on line of drug
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
        const prd_tbl = document.getElementById('prd-tbl')
        $(prd_tbl).bootstrapTable("destroy");
        $(prd_tbl).bootstrapTable({columns: drug_cols});

        let rows = [{cat: "<span class=''>Predictions</span>"}, {cat: ""}];
        meta.catalogs.forEach((d) => {
            rows.push({'cat': d})
        });


        drugs.forEach((d) => {
            rows[0][d] = parse_prediction(preds[d])
            rows[1][d] = ''
            let idx = 2
            meta.catalogs.forEach((c) => {
                rows[idx][d] = parse_cataloge(mutations[d][c])
                idx++;

            });
        });
        rows.reverse().forEach((r) => {
            $(prd_tbl).bootstrapTable("insertRow", {index: 0, row: r})
        })

        let tbl_rows = prd_tbl.querySelectorAll('tr')
        let idx = 0
        tbl_rows.forEach((r) => {
            if (idx === 2) {
                r.classList.add('table-secondary')
            }
            if (idx > 2) {
                r.classList.add('table-light')
            }
            idx++;
        })

        function select_column(index, class_names = "") {
            if (index === 0) return
            $('#prd-tbl tr').each(function () {
                if ($(this).data('index') !== 1) {
                    $(this).find('th').eq(index).addClass(`col-highlight-header ${class_names}`);
                    $(this).find('td').eq(index).addClass(`col-highlight ${class_names}`);
                }
            });
        }

        function deselect_column(index, class_names = "") {
            if (index === 0) return
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

        fill_unverified_mu(unverif_mutations);
    }

    function fill_evidence(drug) {

        let evidence = repo[selected_sample]['evidence'][drug]
        if (!evidence) {
            reset_evidence()
            return
        }
        $("#evidence_row").css("display", "block")
        const evd_tbl = document.getElementById('evd-tbl')
        $(evd_tbl).bootstrapTable("removeAll");
        let color_mapper = {'R': 'text-r', 'U': 'text-u'}
        evidence.forEach((r) => {
            let cl = r.pred ? color_mapper[r.pred] : 'text-o'
            r.pred_icon = `<span class="${cl}"><i class="fas fa-circle"></i></span>`
            $(evd_tbl).bootstrapTable("insertRow", {index: 0, row: r})
        });


    }

    function fill_unverified_mu(mutations) {


        if (!mutations) {
            return
        }
        const umu_tbl = document.getElementById('umu-tbl')
        $(umu_tbl).bootstrapTable("removeAll");
        let color_mapper = {'R': 'text-r', 'U': 'text-u'}
        mutations.forEach((r) => {
            let cl = r.pred ? color_mapper[r.pred] : 'text-o'
            r.pred_icon = `<span class="${cl}"><i class="fas fa-circle"></i></span>`
            $(umu_tbl).bootstrapTable("insertRow", {index: 0, row: r})
        });


    }

    function reset_evidence() {
        $("#evidence_row").css("display", "none")
        const evd_tbl = document.getElementById('evd-tbl')
        $(evd_tbl).bootstrapTable("removeAll");
    }

    function parse_prediction(pred) {

        let color_mapper = {'R': 'text-r', 'U': 'text-u'}
        let header_icon = document.createElement('div');
        header_icon.className = 'row';
        let flexContainer = document.createElement('div');
        flexContainer.className = 'd-flex justify-content-evenly';

        // Iterate over the icons array and create each icon
        meta.catalogs.forEach(function (cat) {
            let pred_cat = pred[cat]
            let link = document.createElement('a');
            link.className = `cat-circle ${pred_cat ? color_mapper[pred_cat] : 'text-o'}`;

            link.setAttribute('title', cat);
            link.innerHTML = `<i class="fas fa-circle"></i>`;
            flexContainer.appendChild(link);

        });

        // Append the flex container to the first row
        header_icon.appendChild(flexContainer);

        // Create the second row with the text final prediction
        let row2 = document.createElement('div');
        row2.className = 'row';
        let pf = pred['final_pred']
        let text_color = pf ? color_mapper[pf] : 'text-o';
        row2.innerHTML = `<span class="text-center text-outlined ${text_color}">${pf}</span>`

        let hr = document.createElement('hr')
        hr.className = 'p-0 m-0'

        // Append the rows to the container
        var container = document.createElement('div');
        container.appendChild(row2);
        container.appendChild(hr);
        container.appendChild(header_icon);

        return $(container).prop('outerHTML')
    }

    function parse_cataloge(mutations) {
        if (!mutations) {
            return `<span class="text-secondary">-</span>`
        }
        mutations.sort(function (a, b) {
            return a - b;
        });
        let mu_tags = []
        mutations.forEach((mu) => {
                let cl = mu.pred === "R" ? "text-r" : "text-u";
                if (mu.format === 'GARC1') {
                    mu_tags.push(`<p class='${cl} text-mutation m-0 p-0'>${mu.variant}</p>`)
                } else {
                    let bg_cl;
                    if (mu.freq >= 0.8) {
                        bg_cl = "badge-success"
                    } else if (mu.freq >= 0.5) {
                        bg_cl = "badge-warning"
                    } else {
                        bg_cl = "badge-danger"
                    }
                    let badge = `<span class="badge rounded-pill opacity-75 ${bg_cl}" title="Depth: ${mu.depth}">${mu.freq} <span class="visually-hidden">Frequency</span></span>`;
                    mu_tags.push(`<p class='text-mutation ${cl} small text-mutated m-0 p-0'>${mu.gene}@${mu.variant} ${badge}</p>`)
                }
            }
        )
        ;

        return mu_tags.join("")

    }


});