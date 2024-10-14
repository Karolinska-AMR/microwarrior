$(document).ready(function () {

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
});