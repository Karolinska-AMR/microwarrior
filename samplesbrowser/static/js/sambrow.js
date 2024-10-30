$(document).ready(function () {

    let repo = {};
    let search_repo = {};
    let meta = {};

    var TB_DRUGS = {
        "first_line": {
            "title": gettext("Första linjens anti-TB-läkemedel"),
            "drugs": ["isoniazid", "rifampicin", "pyrazinamide", "ethambutol", "streptomycin"]
        }, "second_line": {
            "title": gettext("Andra linjens anti-TB-läkemedel"),
            "drugs": ["linezolid", "ethionamide", "levofloxacin", "moxifloxacin"]
        }, "other": {
            "title": gettext("Övriga anti-TB-läkemedel"),
            "drugs": ["bedaquiline", "delamanid", "amikacin", "capreomycin", "kanamycin", "clofazimine"]
        }
    };
    let WHO_Drugs = Object.values(TB_DRUGS).flatMap(it => it.drugs);

    function init() {

        fetch_meta();
        adjust_viewbar();
        put_pred_layout();

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

        let tables = ['lin-tbl', 'mu-who-tbl', 'mu-tbp-tbl', 'mu-cryp-tbl', 'umu-tbl', 'meta-tbl', 'search-tbl'];
        let table_type = (name) => name.startsWith('search') ? 'table-modal' : 'table-main';

        tables.forEach((tn) => {
            const tbl = document.getElementById(tn);
            $(tbl).bootstrapTable('destroy');
            $(tbl).bootstrapTable({
                formatNoMatches: function () {
                    return `<i class="fas fa-info"></i> ${gettext("Inga data att visa.")}`;
                },
                classes: "table table-sm text-sm table-hover table-striped " + table_type(tn),
                onResetView: function (e) {
                    var popoverTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="popover"]'))
                    var popoverList = popoverTriggerList.map(function (popoverTriggerEl) {
                        return new bootstrap.Popover(popoverTriggerEl)
                    })
                }
            });
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
                search_alert(gettext('Vänligen fyll i minst ett fält.'));

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
                search_alert(gettext("Sök och hämta minst ett prov."));
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
                search_alert(gettext("Sök och hämta minst ett prov."));
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

        let cardBody = document.querySelector("#pred_card .card-body");
        cardBody.addEventListener('dblclick', function (event) {
            document.querySelectorAll('.collapse').forEach(collapse => $(collapse).collapse('hide'));
            event.stopPropagation();
        });

        $("#mu_card .nav-item").on("click", function (event) {
            $("#mu_card .nav-link").removeClass('active');
            let navlink = $(this).find('.nav-link')
            navlink.addClass('active');
            $('.panel').hide();
            var panelId = $(navlink).attr('data-target');
            $('#' + panelId).show();
        });
    }

    function adjust_viewbar() {
        $('#viewbar').css('height', $(window).height() - 200).css('max-height', $(window).height() - 200);
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
                    search_alert(gettext('Inga matchningar hittades.'));
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
                                ${gettext("För närvarande Visas")}: 
                                <span class="h5 text-${repo[sid].info.category.toLowerCase()}"> ${repo[sid].info.sample}</span>`);

        $('a[data-target="who-panel"]').trigger('click');

        update_table_loading('showLoading');
        reset_predictions();

        setTimeout(function () {
            if (!repo[sid].dcheck) {
                fetch_mutations(sid);
            } else {
                update_page(sid);
            }
        }, 100);
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
        let tables = document.querySelectorAll('table');
        tables.forEach((tn) => {
            $(tn).bootstrapTable(status);
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

        console.log(data);

        reset_predictions(); // in case of double-click or delay in fetching data clean the prediction


        let unverif_mutations = data['unverified_mutations'];

        // Lineage
        fill_lineage(data.info.lineage);

        update_predictions(data);

        fill_mu_catalogs(data);

        fill_unverified_mu(unverif_mutations);

        //meta-data
        fill_metadata(data.info);


        update_table_loading('hideLoading');
    }

    function fill_lineage(data) {
        const lin_tbl = document.getElementById('lin-tbl');
        $(lin_tbl).bootstrapTable("removeAll");
        $(lin_tbl).bootstrapTable("insertRow", {index: 0, row: data});
    }

    function fill_metadata(data) {
        const tbl = document.getElementById('meta-tbl');
        $(tbl).bootstrapTable("removeAll");
        data.mapped_reads = data.mapped_reads.toLocaleString()
        $(tbl).bootstrapTable("insertRow", {index: 0, row: data});
    }

    function fill_mu_catalogs(data) {
        const whoTable = $('#mu-who-tbl');
        const crypTable = $('#mu-cryp-tbl');
        const tbpTable = $('#mu-tbp-tbl');

        // Clear all tables before inserting new data
        whoTable.bootstrapTable("removeAll");
        crypTable.bootstrapTable("removeAll");
        tbpTable.bootstrapTable("removeAll");

        const mutations = data.mutations;
        const drugs = sortDrugs(Object.keys(mutations), WHO_Drugs.map(d => d.toUpperCase()));

        drugs.reverse().forEach((dname) => {
            dname = dname.toUpperCase();

            if (!(dname in mutations)) return;

            Object.entries(mutations[dname]).forEach(([cat_name, mulst]) => {
                const targetTable =
                    cat_name.startsWith('WHO') ? whoTable :
                        cat_name.startsWith('CRyPTIC') ? crypTable :
                            cat_name.startsWith('TB-Profiler') ? tbpTable : null;

                if (!targetTable) return;

                mulst.forEach((m) => {
                    // Add freq_icon if necessary (for WHO and TB-Profiler)
                    if (cat_name.startsWith('WHO') || cat_name.startsWith('TB-Profiler')) {
                        m.freq_icon = get_freq_badge(m.freq);
                    }
                    // Apply grade badge
                    m = get_grade_badge(m);
                    // Insert row into the relevant table
                    targetTable.bootstrapTable("insertRow", {index: 0, row: m});
                });
            });
        });
    }

    function sortDrugs(drugs, referenceList) {
        return drugs.sort((a, b) => {
            const indexA = referenceList.indexOf(a);
            const indexB = referenceList.indexOf(b);

            // If both drugs are in the reference list, sort by their order in the reference list
            if (indexA !== -1 && indexB !== -1) {
                return indexA - indexB;
            }

            // If one drug is in the reference list and the other isn't, prioritize the one in the reference list
            if (indexA !== -1) return -1;
            if (indexB !== -1) return 1;

            // If neither are in the reference list, leave them as they are
            return 0;
        });
    }

    function get_freq_badge(freq) {
        // Define badge class based on frequency
        let bg_cl;
        if (freq >= 0.8) {
            bg_cl = "badge-success";
        } else if (freq >= 0.5) {
            bg_cl = "badge-warning";
        } else {
            bg_cl = "badge-danger";
            const msg = `<span class='text-muted'>${gettext("En lågfrevent mutation har hittats. Vänligen diskutera dess möjliga påverkan på resultaten.")}</span>`;
            const titleText = gettext("Lågfrevent mutation upptäckt");

            // Return badge with popover for low-frequency mutations
            return `
            <span class="table-info" tabindex="0" 
                data-bs-toggle="popover" data-bs-trigger="hover focus" 
                data-bs-content="${msg}" data-bs-title="${titleText}" data-bs-html="true">
                <span class="badge ${bg_cl}">${(freq * 100).toFixed(1)}%</span> 
                <i class="fas fa-exclamation-triangle text-warning"></i>
            </span>`;
        }

        // Return badge without popover for higher frequencies
        return `<span class="badge ${bg_cl}">${(freq * 100).toFixed(1)}%</span>`;
    }


    function get_grade_badge(d) {
        // No grade available
        if (!d.grade) {
            const msg = `<span class='text-muted'>${gettext("Ingen exakt matchning för mutationen hittades i WHO:s katalog. Förutspådd funktionell påverkan: funktionsförlust")}</span>`;
            const titleText = gettext("Länka mutation och bevis");

            const popoverContent = (content) => `
            <span class="table-info text-muted fst-italic" tabindex="0" 
                data-bs-toggle="popover" data-bs-trigger="hover focus" 
                data-bs-content="${msg}" data-bs-title="${titleText}" data-bs-html="true">
                 ${content} <i class="fas fa-info-circle text-info"></i></span>`;

            if (d.cat_pred === 'U') {
                d.grade_icon = `<span class="badge text-bg-u fst-italic text-muted">3. ${gettext("Osäker signifikans")}</span>`;
                d.effect = popoverContent('LOF');
            } else if (d.cat_pred === 'R') {
                d.grade_icon = `<span class="badge text-bg-r fst-italic text-muted">1. ${gettext("Associerad med resistens")}</span>`;
                d.effect = popoverContent('LOF');
            } else {
                d.grade_icon = `<span class="badge text-bg-o">${d.cat_pred}</span>`;
            }

            return d;
        }

        // Grade is available
        const gradeClasses = {
            '1': "text-bg-r",
            '2': "text-bg-ri",
            '3': "text-bg-u",
            '4': "text-bg-si",
            '5': "text-bg-s"
        };

        const gradeKey = Object.keys(gradeClasses).find(key => d.grade.startsWith(key)) || 'default';

        d.grade = d.grade.startsWith('1') ? "1. " + gettext("Associerad med resistens") :
            d.grade.startsWith('2') ? "2. " + gettext("Associerad med resistens-interim") :
                d.grade.startsWith('3') ? "3. " + gettext("Osäker signifikans") :
                    d.grade.startsWith('4') ? "4. " + gettext("Känslig-interim") :
                        d.grade.startsWith('5') ? "5. " + gettext("Känslig") : null;

        d.grade_icon = `<span class="badge ${gradeClasses[gradeKey] || ''}">${gettext(d.grade)}</span>`;
        d.effect = d.effect;  // Assuming d.effect is already defined

        return d;
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

    //---------------
    function put_pred_layout() {

        let cardBody = $("#pred_card .card-body");
        let active_row;

        $.each(TB_DRUGS, function (k, v) {
            cardBody.append(`<h5 class="mt-2 text-center text-muted">${v.title}</h5>`)
            names = v.drugs
            for (let index = 0; index < names.length; index++) {
                if (index % 2 === 0) {
                    if (index > 0) {
                        cardBody.append(active_row);
                    }
                    active_row = document.createElement("div");
                    active_row.className = "row";
                }
                active_row.append(create_drug_card(names[index]));
            }
            cardBody.append(active_row);
        });
        // Add event listeners to handle icon toggle
        document.querySelectorAll('.collapse').forEach(collapse => {
            collapse.addEventListener('show.bs.collapse', function (event) {
                const button = this.previousElementSibling.querySelector('.toggle-icon');
                button.classList.remove('fa-plus');
                button.classList.add('fa-minus');
            });

            collapse.addEventListener('hide.bs.collapse', function (event) {
                const button = this.previousElementSibling.querySelector('.toggle-icon');
                button.classList.remove('fa-minus');
                button.classList.add('fa-plus');
            });
        });

    }

    function create_drug_card(dname) {

        dname = dname.toLowerCase()
        // Create the new content to be added
        var newContent = document.createElement("div");
        newContent.className = "col-md-6 mb-1";

        // Create the card element
        var card = document.createElement("div");
        card.className = "card border-left-o shadow-sm";
        card.id = `${dname}-card`
        newContent.appendChild(card);

        // Create the card header
        var cardHeader = document.createElement("div");
        cardHeader.className = "card-header pred-box-header bg-light py-1";
        card.appendChild(cardHeader);

        // Create the icon circle
        var iconCircle = document.createElement("div");
        iconCircle.className = "icon-circle";
        cardHeader.appendChild(iconCircle);

        // Create the pred-circle
        var predCircle = document.createElement("div");
        predCircle.className = "pred-circle text-capitalize shadow-text text-bg-o";
        predCircle.id = `${dname}-predcircle`
        predCircle.textContent = "?";
        iconCircle.appendChild(predCircle);

        // Create the card title
        var cardTitle = document.createElement("span");
        cardTitle.className = "card-title mb-0 text-uppercase";
        cardTitle.textContent = dname;
        cardHeader.appendChild(cardTitle);

        var infoIcons = document.createElement("div");
        infoIcons.id = `${dname}-info`;
        infoIcons.className = "info-icons";

        // Create the collapse button
        let collapse_id = `collapseCard-${dname}`
        var collapseButton = document.createElement("button");
        collapseButton.className = "btn btn-link btn-sm";
        collapseButton.type = "button";
        collapseButton.setAttribute("data-bs-toggle", "collapse");
        collapseButton.setAttribute("data-bs-target", '#' + collapse_id);
        collapseButton.setAttribute("aria-expanded", "false");
        collapseButton.setAttribute("aria-controls", collapse_id);

        infoIcons.appendChild(collapseButton);
        cardHeader.appendChild(infoIcons);

        // Create the collapse icon
        var collapseIcon = document.createElement("i");
        collapseIcon.className = "fas fa-plus toggle-icon";
        collapseButton.appendChild(collapseIcon);

        // Create the collapse content
        var collapseContent = document.createElement("div");
        collapseContent.id = collapse_id;
        collapseContent.className = "collapse";
        card.appendChild(collapseContent);

        // Create the card body
        var cardBodyInner = document.createElement("div");
        cardBodyInner.className = "card-body p-1";
        collapseContent.appendChild(cardBodyInner);

        var container = document.createElement("div");
        container.className = "info-header-cont";

        // Create the resistance mutations paragraph
        var resistanceMutationsParagraph = document.createElement("p");
        resistanceMutationsParagraph.className = "my-1 text-center fs-6 fw-bold";
        resistanceMutationsParagraph.textContent = gettext("Resistansmutationer");
        container.appendChild(resistanceMutationsParagraph);

        // Create the mubadges div
        var mubadgesDiv = document.createElement("div");
        mubadgesDiv.className = "d-flex justify-content-center mubadges";
        container.appendChild(mubadgesDiv);

        // Create the horizontal line
        var horizontalLine = document.createElement("hr");
        horizontalLine.className = "m-1";
        container.appendChild(horizontalLine);
        cardBodyInner.append(container);

        // Create the notes paragraph
        var notesParagraph = document.createElement("p");
        notesParagraph.className = "my-1 text-center fs-6 fw-bold";
        notesParagraph.textContent = gettext("Noteringar");
        cardBodyInner.appendChild(notesParagraph);


        // Create the notes div
        var notesDiv = document.createElement("div");
        notesDiv.className = "d-flex flex-column notes";
        cardBodyInner.appendChild(notesDiv);

        return newContent;

    }

    function update_predictions(data) {
        let who_cat;
        let prds = data.predictions;
        let muts = data.mutations;
        data.catalogues.forEach(function (cat, _) {
            if (cat.startsWith('WHO')) {
                who_cat = cat;
            }
        });

        //TODO: Check if WHO passed, Don't show S for all

        $.each(WHO_Drugs, function (idx, dname) {
            let card = document.getElementById(`${dname}-card`);
            let circle_icon = document.getElementById(`${dname}-predcircle`);
            let info_icon = document.getElementById(`${dname}-info`);
            let info_header = $(card).find('.info-header-cont');
            let mu_badges_tag = $(card).find('.mubadges');
            let mu_notes_tag = $(card).find('.notes');

            $(card).removeClass(function (index, className) {
                return (className.match(/(^|\s)border-left\S+/g) || []).join(' ');
            });
            $(circle_icon).removeClass(function (index, className) {
                return (className.match(/(^|\s)text-bg\S+/g) || []).join(' ');
            });
            let key = dname.toUpperCase();

            let dprd = 'N';
            let source;
            if (key in prds) {
                dprd = prds[key]['prediction'];
                source = prds[key]['source'];
                add_mutations_notes(mu_notes_tag, muts[key][who_cat]);
            }

            if (dprd === 'R') {
                $(card).addClass('border-left-r');
                $(circle_icon).addClass(source.startsWith('cata') ? 'text-bg-r' : "text-outlined-r");
                $(info_header).show();
                $(circle_icon).text(dprd);
                if (source.startsWith('notes')) {
                    $(circle_icon).parent().append(`<sub class="fw-bold text-muted"> ${gettext("Enligt Noteringar")}</sub>`);
                }
                add_mu_badges(mu_badges_tag, muts[key][who_cat]);

            } else if (dprd === 'U') {
                $(card).addClass('border-left-ds');
                $(circle_icon).addClass(source.startsWith('cata') ? 'text-bg-s' : "text-outlined-s");
                $(circle_icon).text('S');
                $(info_header).hide();
                $(info_icon).prepend('<span class="u-icon shadow-text">U</span> ');

            } else if (dprd === 'K') {
                $(card).addClass('border-left-k');
                $(circle_icon).addClass('text-bg-k blinking-text');
                $(info_header).show();
                $(circle_icon).text('!');
                $(circle_icon).parent().append(`<sub class="fw-bold text-muted"> ${gettext("Motstridiga Noteringar")}</sub>`);
                add_mu_badges(mu_badges_tag, muts[key][who_cat]);

            } else if (dprd === 'N' || !dprd) {
                $(card).addClass('border-left-ds');
                $(circle_icon).addClass('text-bg-s');
                $(circle_icon).text('S');
                $(info_header).hide();

            }
            add_comments(mu_notes_tag, dprd)


        });
    }

    function reset_predictions() {
        let cardBody = $("#pred_card .card-body");
        cardBody.find('.collapse').each(function () {
            $(this).collapse('hide');
        });
        cardBody.find('.pred-circle').each(function () {
            $(this).text('-');
            $(this).parent().find('sub').remove();

            $(this).closest('.card').removeClass(function (index, className) {
                return (className.match(/(^|\s)border-left\S+/g) || []).join(' ');
            }).addClass("border-left-o");

            this.classList.forEach((cl) => {
                if(cl.startsWith("text-bg") || cl.startsWith("text-out") || cl.startsWith('blinking')){
                    $(this).removeClass(cl);
                }
            })
            $(this).addClass("text-bg-o");
        });

        cardBody.find('.info-icons').each(function () {
            $(this).children().not(":last-child").remove();
        });
        cardBody.find('.mubadges').each(function () {
            $(this).children().remove();
        });
        cardBody.find('.notes').each(function () {
            $(this).children().remove();
        });

    }

    function add_mu_badges(ptag, mutations) {
        mutations.forEach(function (m) {
            if (m.cat_pred === 'R') {
                $(ptag).append(`<span class="badge text-bg-light text-danger fw-light fs-6 mx-1">${m.mutation}</span>`);
            }
        });
    }

    function add_comments(ptag, type) {
        const comments = {
            'U': gettext("Mutationer med osäker signifikans hittades. Se tabellen nedan för mer information."),
            'S': gettext("Inga mutationer associerade med resistens eller osäker signifikans från WHO katalog hittades."),
            '': gettext("Inga mutationer associerade med resistens eller osäker signifikans från några kataloger hittades.")
        };

        if (type === 'R') return;

        const comment = comments[type] || comments[''];
        $(ptag).prepend(`<p class="mx-2 my-1"><i class="fas fa-info-circle text-info"></i> <span class="text-muted">${comment}</span></p>`);
    }

    function add_mutations_notes(ptag, mutations) {
        if (!mutations) return;

        let has_note = false;
        mutations.forEach(function (m) {
            if (m.notes.length > 0) {
                has_note = true;
            }
            m.notes.forEach(function (note) {
                $(ptag).append(create_note_alert(m.mutation, m.cat_pred, note));
            })
        });
        if (!has_note) {
            $(ptag).append(`<span class="text-center fw-light-lighter fs-6 fst-italic">${gettext("Inga sparade noteringar.")}</span>`)
        } else {
            let icon_info = $(ptag).closest('.card').find('.card-header .info-icons');
            icon_info.prepend('<i class="fas fa-lg fa-receipt text-info"></i> ');
        }

    }

    function get_pred_bg(p) {
        p = p.toLowerCase();
        return $.inArray(p, ['r', 'u', 's']) !== -1 ? 'text-bg-' + p : 'text-bg-o';
    }

    function get_pred_txt(p) {
        p = p.toLowerCase();
        return $.inArray(p, ['r', 'u', 's']) !== -1 ? 'text-' + p : 'text-dark';
    }

    function create_note_alert(mu, pred, d) {
        // Create the outermost div (alert-light)
        let alertDiv = document.createElement('div');
        alertDiv.className = "alert alert-light p-1 mx-2 my-1";

        // Create the alert heading div
        let alertHeadingDiv = document.createElement('h6');
        alertHeadingDiv.className = "alert-heading text-center";
        $(alertHeadingDiv).html(`<strong>${mu}</strong> [<small class="${get_pred_txt(pred)}">${pred}</small>]`);
        // alertHeadingDiv.setAttribute("style","font-size:0.7rem");
        // Create the first inner div with buttons and user info
        let innerDiv1 = document.createElement('div');
        innerDiv1.classList.add('d-flex', 'justify-content-between');
        innerDiv1.setAttribute("style", "font-size:0.7rem");

        // Create the user info section
        let userInfoDiv = document.createElement('div');
        userInfoDiv.classList.add('d-flex', 'justify-content-end', 'align-items-center', 'flex-wrap', 'fs-small');

        let editDateDiv = document.createElement('div');
        editDateDiv.classList.add('me-3');
        let editDateLabel = document.createElement('span');
        editDateLabel.innerText = `${gettext('Redigerades på')}: `;
        let editDateValue = document.createElement('span');
        editDateValue.classList.add('fst-italic');
        editDateValue.id = 'date-lbl';
        editDateValue.innerText = d.last_edit;

        editDateDiv.appendChild(editDateLabel);
        editDateDiv.appendChild(editDateValue);

        let editedByDiv = document.createElement('div');
        editedByDiv.classList.add('me-3');
        let editedByLabel = document.createElement('span');
        editedByLabel.innerText = `${gettext('Av')}: `;
        let editedByValue = document.createElement('span');
        editedByValue.classList.add('text-uppercase', 'fst-italic');
        editedByValue.id = 'usr-lbl';
        editedByValue.innerText = d.author;

        editedByDiv.appendChild(editedByLabel);
        editedByDiv.appendChild(editedByValue);

        // Append user info to the user info div
        userInfoDiv.appendChild(editDateDiv);
        userInfoDiv.appendChild(editedByDiv);

        // Append button group and user info to the first inner div
        innerDiv1.appendChild(userInfoDiv);

        // Append first inner div to the alert heading

        // alertHeadingDiv.appendChild(innerDiv1);

        // Create the <hr> separator
        let hr1 = document.createElement('hr');
        hr1.className = "my-1"

        let hr2 = document.createElement('hr');
        hr2.className = "my-1"
        // Create the row for note and predicted outcome
        let rowDiv = document.createElement('div');
        rowDiv.classList.add('row');

        // Create the note column
        let noteCol = document.createElement('div');
        noteCol.classList.add('col-9');
        let noteText = document.createElement('p');
        noteText.classList.add('text-dark');
        noteText.id = 'note-text';
        noteText.innerText = gettext(d.note);
        noteCol.appendChild(noteText);

        // Create the prediction column
        let predCol = document.createElement('div');
        predCol.classList.add('col-3');

        let predTitle = document.createElement('h6');
        predTitle.classList.add('text-center', 'text-capitalize');
        let strongTitle = document.createElement('strong');
        strongTitle.innerText = `${gettext('föreslagit resultat')}:`;
        predTitle.appendChild(strongTitle);


        let predCircle = document.createElement('div');
        predCircle.className = 'pred-circle text-capitalize d-flex ' + get_pred_bg(d.prediction) +
            ' justify-content-center align-items-center mx-auto';
        predCircle.id = 'note-pred';
        predCircle.innerText = d.prediction;

        predCol.appendChild(predTitle);
        predCol.appendChild(predCircle);

        // Append columns to the row
        rowDiv.appendChild(noteCol);
        rowDiv.appendChild(predCol);

        // Append everything to the main alert div
        alertDiv.appendChild(alertHeadingDiv);
        alertDiv.appendChild(hr1);
        alertDiv.appendChild(rowDiv);
        alertDiv.appendChild(hr2);
        alertDiv.appendChild(innerDiv1);
        return alertDiv
    }

    init();

});