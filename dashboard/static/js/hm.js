$(document).ready(function () {

    var feeds = {'news': [], 'ms': []};


    function fetch_feed(url, out, type) {
        $.ajax({
            url: 'https://api.rss2json.com/v1/api.json',
            method: 'GET',
            dataType: 'json',
            data: {
                rss_url: url
            },
            success: function (data) {
                out[type].push(...data.items);
            }
        });
    }

    function add_feed(data, tag) {
        const newsFeedElement = document.getElementById(tag)
        data.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate))

        $.each(data, function (i, d) {
            if (i === 10) {
                return false;
            }
            const card = document.getElementById('news-template')
            let tmp = $(card).clone()
            $(tmp).attr('style', 'display:block;')
            $(tmp).find('a').attr('href', d.link).text(d.title);
            $(tmp).find('.dscr').text(d.description);
            $(tmp).find('.dt').text(d.pubDate);
            $(newsFeedElement).append(tmp);
        });
    }

    $(".lan-link").on("click", function (event) {

        send_lan($(this).attr('data-lan'));


    });

    function send_lan(language) {
        const form = document.getElementById('language-switcher');
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = 'language';
        input.value = language;
        form.appendChild(input);
        form.submit();
    }

    fetch_feed('https://www.sciencedaily.com/rss/health_medicine/tuberculosis.xml', feeds, 'news');
    fetch_feed('https://www.ecdc.europa.eu/en/taxonomy/term/1307/feed', feeds, 'news');
    fetch_feed('https://pubmed.ncbi.nlm.nih.gov/rss/search/12YY5Cbua67LOmQXAGezOZocEGMWwJE4_HTbHx2JN7f9HaCYFh/?limit=20&utm_campaign=pubmed-2&fc=20230913121323', feeds, 'ms');
    fetch_feed('https://www.nature.com/subjects/tuberculosis.rss', feeds, 'ms');

    setTimeout(function () {
        add_feed(feeds.news, "news-feed");
        add_feed(feeds.ms, "ms-feed");
    }, 2000);

});