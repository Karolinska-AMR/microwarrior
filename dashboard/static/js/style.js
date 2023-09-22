$(document).ready(function () {
    $("#sidebarToggle, #sidebarToggleTop").on("click", function (e) {
      $("body").toggleClass("sidebar-toggled"),
        $(".sidebar").toggleClass("toggled"),
        $(".sidebar").hasClass("toggled") &&
          $(".sidebar .collapse").collapse("hide");
    }),
      $(window).resize(function () {
        $(window).width() < 768 && $(".sidebar .collapse").collapse("hide"),
          $(window).width() < 480 &&
            !$(".sidebar").hasClass("toggled") &&
            ($("body").addClass("sidebar-toggled"),
            $(".sidebar").addClass("toggled"),
            $(".sidebar .collapse").collapse("hide"));
      }),
      $("body.fixed-nav .sidebar").on(
        "mousewheel DOMMouseScroll wheel",
        function (e) {
          var o;
          768 < $(window).width() &&
            ((o = (o = e.originalEvent).wheelDelta || -o.detail),
            (this.scrollTop += 30 * (o < 0 ? 1 : -1)),
            e.preventDefault());
        }
      ),
      $(document).on("scroll", function () {
        100 < $(this).scrollTop()
          ? $(".scroll-to-top").fadeIn()
          : $(".scroll-to-top").fadeOut();
      }),
      $(document).on("click", "a.scroll-to-top", function (e) {
        var o = $(this);
        $("html, body")
          .stop()
          .animate(
            { scrollTop: $(o.attr("href")).offset().top },
            1e3,
            "easeInOutExpo"
          ),
          e.preventDefault();
      });

      
  });