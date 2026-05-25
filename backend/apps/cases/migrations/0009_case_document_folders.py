from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("cases", "0008_case_procedural_actions"),
    ]

    operations = [
        migrations.AddField(
            model_name="case",
            name="document_folders",
            field=models.JSONField(blank=True, default=list),
        ),
    ]
