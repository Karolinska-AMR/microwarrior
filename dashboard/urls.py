from django.urls import path
from . import views

urlpatterns = [
    path('', views.dashboard, name="home"),
    # path('', views.home, name="home"),

    path('dashboard', views.dashboard, name="dashboard"),
    path('fetchjobs', views.get_jobs, name='fetch_job'),
    path('enqjob',views.enqueue_task,name='enqjob'),
]