from django.urls import path, re_path


from . import views

urlpatterns = [
    path('', views.home, name="home"),
    path('dashboard', views.dashboard, name="dashboard"),
    path('fetchjobs', views.get_jobs, name='fetch_job'),
    path('fetchlog', views.get_log, name='fetch_log'),
    path('enqjob',views.enqueue_task,name='enqjob'),
    re_path(r'^fetch-overview/$', views.get_overview, name='fetch_overview'),
    re_path(r'^chk-ids/$', views.check_sample_ids, name='check_sampleid'),

    re_path(r'^catalog/$', views.under_construction, name='catalog'),
    re_path(r'^help/$', views.under_construction, name='help'),
]

