from django.urls import path
from . import views

urlpatterns = [
    path('upload/<slug:ticket>', views.upload, name="upload"),
]
