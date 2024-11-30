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
                <span class="badge ${bg_cl}">${(freq * 100).toFixed(1)}</span> 
                <i class="fas fa-exclamation-triangle text-warning"></i>
            </span>`;
        }

        // Return badge without popover for higher frequencies
        return `<span class="badge ${bg_cl}">${(freq * 100).toFixed(1)}</span>`;
    }

    function get_grade_badge(d, oclass = "") {
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
                d.grade_icon = `<span class="badge text-bg-u fst-italic text-muted ${oclass}">3. ${gettext("Osäker signifikans")}</span>`;
                d.effect = popoverContent('LOF');
            } else if (d.cat_pred === 'R') {
                d.grade_icon = `<span class="badge text-bg-r fst-italic text-muted ${oclass}">1. ${gettext("Associerad med resistens")}</span>`;
                d.effect = popoverContent('LOF');
            } else {
                d.grade_icon = `<span class="badge text-bg-o ${oclass}">${d.cat_pred}</span>`;
            }

            return d;
        }

        const gradeClasses = {
            '1': "text-bg-r",
            '2': "text-bg-ri",
            '3': "text-bg-u",
            '4': "text-bg-si",
            '5': "text-bg-s"
        };

        d.grade = trans_grades(d.grade);

        const gradeKey = Object.keys(gradeClasses).find(key => d.grade.startsWith(key)) || 'default';

        d.grade_icon = `<span class="badge ${gradeClasses[gradeKey] || ''} ${oclass}">${gettext(d.grade)}</span>`;
        d.effect = d.effect;  // Assuming d.effect is already defined

        return d;
    }

    function trans_grades(g) {
        if (!g) return null;
        return g.startsWith('1') || g === "Assoc w R" ? "1. " + gettext("Associerad med resistens") :
            g.startsWith('2') || g.startsWith("Assoc w R - Interim") ? "2. " + gettext("Associerad med resistens-interim") :
                g.startsWith('3') || g.startsWith("Uncertain significance") ? "3. " + gettext("Osäker signifikans") :
                    g.startsWith('4') ? "4. " + gettext("Känslig-interim") :
                        g.startsWith('5') ? "5. " + gettext("Känslig") : null;

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
                create_drug_tabs(names[index]);
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

    function create_drug_tabs(dname, active = false) {

        dname = dname.toLowerCase();
        const listItem = $('<li></li>');
        const navLinkDiv = $('<div>', {
            class: 'nav-link d-flex justify-content-between',
            'aria-controls': 'home',
            'data-bs-target': `#${dname}-content`,
            role: 'tab',
            'data-bs-toggle': 'tab',
            type: 'button'
        });

        const drugName = $('<span>', {
            class: 'pt-1',
            text: dname
        });

        const iconsContainer = $('<div>', {
            class: 'icons-container'
        });

        const predCircle = $('<span>', {
            class: 'pred-circle ml-2 text-capitalize shadow-text text-bg-o',
            id: `${dname}-predicon`,
            text: '-'
        });

        iconsContainer.append(predCircle);
        navLinkDiv.append(drugName, iconsContainer);
        listItem.append(navLinkDiv);

        $('#drug-list').append(listItem);

        const tabPanel = $('<div>', {
            role: 'tabpanel',
            class: 'tab-pane fade',
            tabindex: 0,
            id: `${dname}-content`
        });

        const tabHeader = $('<div>', {
            class: 'tab-header d-flex justify-content-between align-items-center'
        });

        const drugHeader = $('<h3>', {
            class: 'text-uppercase',
            text: dname
        });

        const predictionHeader = $('<h5>', {
            class: 'text-pred text-o',
            text: '-'
        });


        tabHeader.append(drugHeader, predictionHeader);


        const panelBody = $('<div>', {
            class: 'panel-body'
        });
        const messageContainer = $('<div>', {
            class: 'messages-container'
        });
        const messageHeader = $('<div>', {
            class: 'within-title',
            text: gettext("Meddelanden")
        });
        const messageBody = $('<div>', {
            class: 'messages-body'

        });
        const meBodyContainer = $('<div>', {
            class: 'container-lg'
        });
        messageBody.append(meBodyContainer);
        messageContainer.append(messageHeader, messageBody);

        const mutationContainer = $('<div>', {
            class: 'mutations-container'
        });
        const mutationHeader = $('<div>', {
            class: 'within-title',
            text: gettext("Resistansmutationer")
        });

        const mutationBody = $('<div>', {
            class: 'mutations-body'

        });
        const muBodyContainer = $('<div>', {
            class: 'container d-flex justify-content-evenly'

        });
        mutationBody.append(muBodyContainer);
        mutationContainer.append(mutationHeader, mutationBody);

        const notesContainer = $('<div>', {
            class: 'notes-container'
        });
        const notesHeader = $('<div>', {
            class: 'within-title',
            text: gettext("noteringar")
        });

        const notesBody = $('<div>', {
            class: 'notes-body'

        });
        const noBodyContainer = $('<div>', {
            class: 'container-lg'
        });
        notesBody.append(noBodyContainer);
        notesContainer.append(notesHeader, notesBody);


        panelBody.append(messageContainer, mutationContainer, notesContainer);

        tabPanel.append(tabHeader, panelBody);

        $('#drug-content').append(tabPanel);

    }

    function update_predictions(data) {
        let who_cat;
        let prds = data.predictions;
        let muts = data.mutations;
        let msgs = data.messages;
        data.catalogues.forEach(function (cat, _) {
            if (cat.startsWith('WHO')) {
                who_cat = cat;
            }
        });

        //TODO: Check if WHO passed, Don't show S for all

        $.each(WHO_Drugs, function (idx, dname) {
            const card = $(`#${dname}-card`);
            const pred_icon = $(`#${dname}-predicon`);
            const content_h5 = $(`#${dname}-content .tab-header h5`);

            const muBody = $(`#${dname}-content .panel-body .mutations-body .container`);
            const noBody = $(`#${dname}-content .panel-body .notes-body .container-lg`);
            const meBody = $(`#${dname}-content .panel-body .messages-body .container-lg`);

            content_h5.removeClass(function (index, className) {
                return (className.match(/(^|\s)text-\S+/g) || []).join(' ')
            }).addClass('text-pred');

            $(pred_icon).removeClass(function (index, className) {
                return (className.match(/(^|\s)text-bg\S+/g) || []).join(' ');
            });

            let key = dname.toUpperCase();

            let dprd = 'N';
            let source;
            if (key in prds) {
                dprd = prds[key]['prediction'];
                source = prds[key]['source'];
                add_mutations_notes(noBody, muts[key][who_cat]);
            } else {
                add_mutations_notes(noBody, null);
                add_messages(meBody, [{
                    "text": gettext("Inga mutationer associerade med resistens eller osäker signifikans från WHO katalog hittades."),
                    type: "info"
                }]);
            }
            if (key in msgs) {
                add_messages(meBody, msgs[key]);
            }


            if (dprd === 'R') {

                $(pred_icon).addClass(source.startsWith('cata') ? 'text-bg-r' : "text-outlined-r");
                $(pred_icon).text('R');
                content_h5.text(gettext("resistant"));
                content_h5.addClass('text-r');
                add_resisance_mutations(muBody, muts[key][who_cat]);


            } else if (dprd === 'U') {
                $(card).addClass('border-left-ds');
                $(pred_icon).addClass(source.startsWith('cata') ? 'text-bg-s' : "text-outlined-s");
                $(pred_icon).text('S');
                $(pred_icon).parent().prepend('<span class="u-icon shadow-text">U</span> ');

                content_h5.text(gettext("känslig"));
                content_h5.addClass('text-s');
                muBody.append(`<p class="empty-info text-dark my-2 text-capitalize"><i class="fas fa-info-circle"></i> ${gettext("inga resistensmutationer hittades")}</p>`);

            } else if (dprd === 'F') {
                $(pred_icon).addClass('text-bg-k pulse-text');
                $(pred_icon).text('!');
                content_h5.text(gettext("inte övertygande"));
                content_h5.addClass('text-o');

                add_resisance_mutations(muBody, muts[key][who_cat]);


            } else if (dprd === 'N' || !dprd) {
                $(pred_icon).addClass('text-bg-s');
                $(pred_icon).text('S');
                content_h5.text(gettext("känslig"));
                content_h5.addClass('text-s');
                muBody.append(`<p class="empty-info text-dark my-2 text-capitalize"><i class="fas fa-info-circle"></i> ${gettext("inga resistensmutationer hittades.")}</p>`);

            }


        });
    }

    function reset_predictions() {

        //     reset list headers

        $("#drug-list .icons-container").each(function () {
            $(this).children().not(":last-child").remove();
            $(this).find('.pred-circle').removeClass(function (index, className) {
                return (className.match(/(^|\s)(pulse\S*|text-outlined\S*|text-bg\S*)/g) || []).join(' ');
            }).addClass('text-bg-o').text('-');
        });
        // reset panel-content

        $('.panel-body .empty-info').remove();
        $('.panel-body .mutations-body .container').empty();
        $('.panel-body .notes-body .container-lg').empty();
        $('.panel-body .messages-body .container-lg').empty();

    }

    function add_resisance_mutations(ptag, mutations) {

        mutations.forEach(function (m) {
            if (m.cat_pred === 'R') {
                $(ptag).append(`<div class="card my-1 p-1">
                                     <div class="d-flex flex-column text-center mx-1">
                                        <span class="fs-6 fw-semibold text-r">${m.mutation}</span>
                                        <small class="text-muted">${m.effect ? m.effect : "-"}</small>
                                        <small class="text-primary fw-semibold">${m.grade ? trans_grades(m.grade) : gettext("Associerad med resistens")}</small>
                                     </div>
                               </div>`);
            }
        });
    }

    function add_messages(ptag, messages) {
        function sortByType(a, b) {
            const types = ['info', 'warning', 'danger'];
            return types.indexOf(a.type) - types.indexOf(b.type);
        }

        messages.sort(sortByType);
        const icons = {
            'info': '<i class="fas fa-lg fa-info-circle text-info"></i>',
            'warning': '<i class="fas fa-lg fa-exclamation-triangle text-warning"></i>',
            'danger': '<i class="fas fa-lg fa-exclamation-circle text-danger"></i>',
            '': '<i class="fas fa-lg fa-question-circle text-secondary"></i>',
        };
        messages.forEach(function (m) {
            const icon = icons[m.type] || icons[''];
            const anim = m.type === 'danger' ? "alert-danger-highlight" : "";
            $(ptag).prepend(`<div class="alert alert-${m.type} ${anim} d-flex align-items-center my-1 py-1" role="alert">
                          <span>${icon} ${m.text}</span></div>`);
        });

    }

    function add_mutations_notes(ptag, mutations) {
        if (!mutations) {
            $(ptag).append(`<p class="empty-info text-dark my-2 text-center text-capitalize"><i class="fas fa-info-circle"></i> ${gettext("Inga sparade noteringar.")}</p>`);
            return;
        }

        let has_note = false;
        mutations.forEach(function (m) {
            if (m.notes.length > 0) {
                has_note = true;
            }
            m.notes.forEach(function (note) {
                $(ptag).append(create_note_card(m.mutation, m.grade, note));
            })
        });
        if (!has_note) {
            $(ptag).append(`<p class="empty-info text-dark my-2 text-center text-capitalize"><i class="fas fa-info-circle"></i> ${gettext("Inga sparade noteringar.")}</p>`);
        } else {
            let id = $(ptag).closest('.tab-pane').attr('id');
            if (id) {
                let drug = id.split('-')[0];
                $(`#${drug}-predicon`).parent().prepend('<i class="fas fa-lg fa-receipt text-info"></i> ');
            }
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

    function create_note_card(mu, grade, note) {

        const d = get_grade_badge({"grade": grade}, 'shadow-text');
        const pred_class = get_pred_bg(note.prediction);
        return $(`
        <div class="card mb-2 shadow-sm">
            <!-- Card Header with Mutation Title -->
            <div class="card-header d-flex justify-content-between text-primary py-1 px-2">
                <h6 class="mb-0 mutation-title">${mu}</h6>
                ${d.grade_icon}
            </div>

            <!-- Card Body with Note Content and Suggested Prediction -->
            <div class="card-body py-2 px-3">
                <p class="note-content mb-2">${note.note}</p>
                <div class="suggested-prediction text-dark small">
                    Föreslagen Prediktion: <span class="pred-circle ml-2 text-capitalize shadow-text ${pred_class}">${note.prediction}</span>
                </div>
            </div>

            <!-- Card Footer with User Info and Last Edit Date -->
            <div class="card-footer d-flex justify-content-between align-items-center py-1 px-2">
                <span class="user-name small text-muted"><i class="bi bi-person-circle"></i> ${note.author}</span>
                <small class="text-muted">Redigerad: ${note.last_edit}</small>
            </div>
        </div>
    `);

    }

    init();

});