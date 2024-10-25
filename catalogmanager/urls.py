from django.urls import re_path

from . import views

urlpatterns = [
    # path('samplesbrowser', views.samplesbrowser, name="samplesbrowser"),
    # re_path(r'^get-meta/?$', views.fetch_meta, name="get_meta"),
    # re_path(r'^get-samples/?$', views.fetch_samples, name="get_samples"),
    # re_path(r'^get-mutations/$', views.fetch_mutations, name='get_mutations'),
    re_path(r'^catalog/$', views.catalogs, name='catalog'),
    re_path(r'^get-drgr/?$', views.fetch_drugs_grades, name="get_dr_gr"),
    re_path(r'^get-evidence/?$', views.fetch_evidence, name="get_evidence"),
    re_path(r'^add-note/?$', views.add_note, name="add_note"),

]
