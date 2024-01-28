from django.urls import path
from django.urls import re_path
from . import views

urlpatterns = [
    path('samplesbrowser', views.samplesbrowser, name="samplesbrowser"),
    re_path(r'^get-samples/?$', views.fetch_samples, name="get_samples"),
    re_path(r'^get-mutations/$', views.fetch_mutations, name='get_mutations'),

]