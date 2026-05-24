from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("cases", "0006_casedocument_content"),
    ]

    operations = [
        migrations.AddField(
            model_name="case",
            name="authority_email",
            field=models.EmailField(blank=True, max_length=254),
        ),
    ]
