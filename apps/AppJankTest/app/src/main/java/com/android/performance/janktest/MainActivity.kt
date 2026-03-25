/*
 * Copyright (C) 2026 The Android Open Source Project
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package com.android.performance.janktest

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.systemBarsPadding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            MaterialTheme {
                Surface(
                    modifier = Modifier.fillMaxSize().systemBarsPadding(),
                    color = MaterialTheme.colorScheme.background,
                ) {
                    MainMenuScreen(
                        onOptionClick = { option ->
                            val intent =
                                when (option) {
                                    "ListView" -> Intent(this, ListViewActivity::class.java)
                                    "RecyclerView" -> Intent(this, RecyclerViewActivity::class.java)
                                    "LazyColumn" -> Intent(this, LazyColumnActivity::class.java)
                                    else -> null
                                }
                            intent?.let { startActivity(it) }
                        }
                    )
                }
            }
        }
    }
}

data class Category(val name: String, val options: List<String>)

@Composable
fun MainMenuScreen(onOptionClick: (String) -> Unit) {
    val categories = listOf(Category("Scrolling", listOf("ListView", "RecyclerView", "LazyColumn")))

    LazyColumn(modifier = Modifier.fillMaxSize()) {
        item {
            Text(
                text = "Test your jank!",
                fontSize = 24.sp,
                fontWeight = FontWeight.Bold,
                modifier = Modifier.padding(16.dp),
            )
        }
        categories.forEach { category ->
            item { CategoryHeader(name = category.name) }
            items(category.options) { option ->
                MenuOption(name = option, onClick = { onOptionClick(option) })
            }
        }
    }
}

@Composable
fun CategoryHeader(name: String) {
    Surface(color = Color.LightGray.copy(alpha = 0.3f), modifier = Modifier.fillMaxWidth()) {
        Text(
            text = name,
            fontWeight = FontWeight.Bold,
            modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
        )
    }
}

@Composable
fun MenuOption(name: String, onClick: () -> Unit) {
    Column(modifier = Modifier.fillMaxWidth().clickable { onClick() }.padding(16.dp)) {
        Text(text = name, fontSize = 18.sp)
        HorizontalDivider(modifier = Modifier.padding(top = 16.dp))
    }
}
